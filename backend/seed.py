import os
import ssl
import certifi

os.environ["SSL_CERT_FILE"]= certifi.where()

from dotenv import load_dotenv
from neo4j import GraphDatabase

load_dotenv()

URI =os.getenv("COGNODB_URI")
USER =os.getenv("COGNODB_USER","cognodb")
PASSWORD=os.getenv("COGNODB_PASSWORD")

def seed_database():
    ssl_context = ssl.create_default_context()
    ssl_context.load_verify_locations(
        cafile="/library/frameworks/python.framework/versions/3.14/lib/python3.14/site-packages/certifi/cacert.pem"
    )
    driver = GraphDatabase.driver(URI, auth=(USER, PASSWORD))

    clean_query = "MATCH (n) DETACH DELETE n"

    seed_query = """
CREATE(a1: Account {id: "ACC_101", owner: "Akhil", balance:15000, isFlagged: False})
CREATE(a2: Account {id: "ACC_102", owner: "shiva", balance:4000, isFlagged: True})
CREATE(a3: Account {id: "ACC_103", owner: "Rajesh", balance:8000, isFlagged: False})
CREATE(a4: Account {id: "ACC_104", owner: "pavan", balance:12000, isFlagged: False})


CREATE(d1:Device {deviceId:"ROBERT DJ_99", deviceType:"Mobile", os: "Android"})
CREATE(ip1:IPAddress {ip: "192.168.1.105", location:"offshore VPN"})


CREATE(a1)-[:TRANSFERRED_TO {amount: 5000, timestamp: "2026-08-11T10:00:00Z"}]->(a2)
CREATE(a2)-[:TRANSFERRED_TO {amount: 4800, timestamp: "2026-08-11T10:15:00Z"}]->(a3)
CREATE(a3)-[:TRANSFERRED_TO {amount: 4500, timestamp: "2026-08-11T10:30:00Z"}]->(a1)


CREATE(a1)-[:LOGGED_IN_FROM]->(d1)
CREATE(a2)-[:LOGGED_IN_FROM]->(d1)
CREATE(a1)-[:USER_IP]->(ip1)
CREATE(a2)-[:USER_IP]->(ip1)
"""

    with driver.session() as session:
        print("cleaning database....")
        session.run(clean_query)
        print("Injecting graph data into CognoDB Cloud...")
        session.run(seed_query)
        print("Data seeding complete!")

    driver.close()


if __name__=="__main__":
    seed_database()

