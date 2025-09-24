import os
from tempfile import NamedTemporaryFile
from langchain_community.document_loaders import PyPDFLoader

async def extract_pdf_text(content: bytes, filename: str) -> str:
    """
    Extract text content from a PDF file using PyPDFLoader.
    
    Args:
        content (bytes): The raw PDF file content.
        filename (str): For error messages only.
    
    Returns:
        str: The extracted text content.
    
    Raises:
        Exception: If PDF parsing fails.
    """
    tmp_path = None
    try:
        with NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        loader = PyPDFLoader(tmp_path)
        text_pages = []
        async for page in loader.alazy_load():
            text_pages.append(page.page_content)

        return " ".join(text_pages)

    except Exception as e:
        raise Exception(f"Error parsing PDF '{filename}': {e}")

    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)
