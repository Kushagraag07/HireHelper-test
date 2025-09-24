# db/vector_db.py
import os
from typing import List

from config import settings

from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams

from langchain_qdrant import Qdrant as QdrantVectorStore
from langchain.schema import Document
from langchain.text_splitter import CharacterTextSplitter

# ── Qdrant Cloud client ─────────────────────────────────────────────
_client = QdrantClient(
    url=settings.QDRANT_URL,        # e.g. "https://<your-cluster>.us-west-2-0.aws.cloud.qdrant.io"
    api_key=settings.QDRANT_API_KEY,
    prefer_grpc=False,              # force REST over HTTPS
)

# ── Ensure your 'resumes' collection exists ────────────────────────
_client.recreate_collection(
    collection_name=settings.QDRANT_COLLECTION,
    vectors_config=VectorParams(
        size=768,    
        distance=Distance.COSINE
    ),
)

# ── LangChain wrapper around that collection ───────────────────────
_vector_store = QdrantVectorStore.from_existing_collection(
    embedding=settings.embeddings,
    collection_name=settings.QDRANT_COLLECTION,
    url=settings.QDRANT_URL,
    api_key=settings.QDRANT_API_KEY,
    prefer_grpc=False,              # again, use REST
)

# ── Chunker ────────────────────────────────────────────────────────
_splitter = CharacterTextSplitter(chunk_size=800, chunk_overlap=100)


def index_resume_chunks(resume_id: str, text: str) -> None:
    """
    Split the resume text into ~800-token chunks, tag each with resume_id,
    and upsert them into your Qdrant Cloud 'resumes' collection.
    """
    docs: List[Document] = []
    for i, chunk in enumerate(_splitter.split_text(text)):
        docs.append(Document(
            page_content=chunk,
            metadata={
                "resume_id": resume_id,
                "chunk_id":  f"{resume_id}_{i}"
            }
        ))
    _vector_store.add_documents(documents=docs)


def index_job_description_chunks(job_id: str, description: str) -> List[str]:
    """
    Split the job description into chunks, tag with job_id/type,
    upsert into the same Qdrant collection, and return the raw chunks.
    """
    print(f"Raw Job Description: {repr(description)}")
    docs: List[Document] = []
    chunk_texts: List[str] = []

    for i, chunk in enumerate(_splitter.split_text(description)):
        print(f"Chunk {i}: {repr(chunk)}")  
        docs.append(Document(
            
            page_content=chunk,
            metadata={
                "job_id":    job_id,
                "chunk_id":  f"{job_id}_{i}",
                "type":      "job_description"
            }
        ))
        chunk_texts.append(chunk)

    _vector_store.add_documents(documents=docs)
    return chunk_texts
