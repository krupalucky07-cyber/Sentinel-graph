import os
from dotenv import load_dotenv
from neo4j import GraphDatabase

load_dotenv()

URI = os.getenv("COGNODB_URI")
USER = os.getenv("COGNODB_USER")
PASSWORD = os.getenv("COGNODB_PASSWORD")

print("URI:", URI)
print("USER:", USER)
print("Testing connection...")

driver = GraphDatabase.driver(
    URI,
    auth=(USER, PASSWORD)
)

try:
    driver.verify_connectivity()
    print("✅ CONNECTION SUCCESSFUL!")

except Exception as e:
    print("❌ CONNECTION FAILED!")
    print(type(e).__name__)
    print(e)

finally:
    driver.close()