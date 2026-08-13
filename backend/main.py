import os
import certifi
os.environ["SSL_CERT_FILE"] = certifi.where()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from neo4j import GraphDatabase, exceptions

load_dotenv()

URI = os.getenv("COGNODB_URI")
USER = os.getenv("COGNODB_USER", "cognodb")
PASSWORD = os.getenv("COGNODB_PASSWORD")

app = FastAPI(title="SentinelGraph API")

# Enable CORS for React Frontend
app.add_middleware(
 CORSMiddleware,
 allow_origins=[
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5175",
    "http://127.0.0.1:5175",
    "https://sentinel-graph-alpha.vercel.app",
    ],
 allow_credentials=True,
 allow_methods=["*"],
 allow_headers=["*"],
)

# Initialize Neo4j Driver Connection Pool
driver = None
try:
   driver = GraphDatabase.driver(URI, auth=(USER, PASSWORD))
   #verify the connection
   driver.verify_connectivity()
   print("Connected to CognoDB successfully!")
except Exception as e:
    print(f"CognoDB connection failed: {e}")
    driver = None

@app.get("/api/health")
def health_check():
   if not driver:
      return {
         "status": "ok", 
         "database": "disconnected"
      }
   return {
      "status": "ok",
      "database": "connected"
   }
  

@app.get("/api/detect-fraud")
def detect_fraud():
   if not driver:
      raise HTTPException(status_code=500, detail="Database connection failed.")

   #openCypher travarsal : detect accounts transferring in loops or sharing devies
   query = """
   MATCH (a1:Account)-[r:TRANSFERRED_TO]->(a2:Account)
   OPTIONAL MATCH (a1)-[:LOGGED_IN_FROM]->(d:Device)<-[:LOGGED_IN_FROM]-(a2)
   RETURN
         a1.id AS source_id, a1.owner AS source_name, a1.isFlagged AS source_flagged,
         a2.id AS target_id, a2.owner AS target_name, a2.isFlagged AS target_flagged,
         r.amount AS amount, d.deviceId AS shared_device
   """

   nodes_dict = {}
   links = []


   try:
      with driver.session() as session:
         result = session.run(query)
         for record in result:
            #format Nodes
            src_id = record["source_id"]
            tgt_id = record["target_id"]

            #source node
            if src_id not in nodes_dict:
               nodes_dict[src_id] = {
                  "id": src_id,
                  "name": record["source_name"],
                  "isFlagged": record["source_flagged"]
               }

            #target node
            if tgt_id not in nodes_dict:
               nodes_dict[tgt_id]={
                  "id":tgt_id,
                  "name": record["target_name"],
                  "isFlagged": record["target_flagged"]
               }

            #Format Edge
            links.append({
               "source": src_id,
               "target":tgt_id,
               "amount":record["amount"],
               "sharedDevice": record["shared_device"]
            })

      return{
         "success": True,
         "nodes": list(nodes_dict.values()),
         "links": links
      }
   except exceptions.ServiceUnavailable as e:
      print(f"DATABASE CONNECTION ERROR : {e}")
      raise HTTPException(status_code=503, detail="CognoDB Cloud is currently unreachable.")
   except Exception as e:
      print(f"UNEXPECTED ERROR : {e}")
      raise HTTPException(status_code=500, detail=str(e))

if __name__=="__main__":
   import uvicorn
   uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)


