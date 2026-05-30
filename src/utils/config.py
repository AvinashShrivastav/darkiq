import os
from dotenv import load_dotenv

load_dotenv()

DATA_RAW       = os.getenv("DATA_RAW",       "data/raw")
DATA_PROCESSED = os.getenv("DATA_PROCESSED", "data/processed")
DATA_EXTERNAL  = os.getenv("DATA_EXTERNAL",  "data/external")
DATABASE_URL   = os.getenv("DATABASE_URL",   "postgresql://postgres:secret@localhost:5432/darkiq")
REDIS_URL      = os.getenv("REDIS_URL",      "redis://localhost:6379/0")
