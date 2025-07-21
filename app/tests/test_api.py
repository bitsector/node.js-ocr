import os
import requests
import pytest

SAMPLE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../sample_files'))
OCR_URL = "http://localhost:8080/ocr"

# List all sample files
sample_files = [f for f in os.listdir(SAMPLE_DIR) if os.path.isfile(os.path.join(SAMPLE_DIR, f))]

def test_server_response():
    """Test that the Node.js OCR API server responds on port 8080."""
    url = "http://localhost:8080/"
    try:
        response = requests.get(url, timeout=5)
        # Pass if any response is received
        assert response.status_code >= 100 and response.status_code < 600
    except Exception as e:
        # Fail if no response
        assert False, f"No response from server: {e}"

@pytest.mark.parametrize("filename", sample_files)
def test_ocr_file(filename):
    """
    For each sample file, upload to /ocr endpoint and check that all words in the filename (split by '_', lowercase, excluding extension) are present in the OCR result.
    """
    filepath = os.path.join(SAMPLE_DIR, filename)
    words = os.path.splitext(filename)[0].lower().split('_')
    
    print(f"\n=== Testing {filename} ===")
    print(f"Expected words: {words}")
    print(f"File path: {filepath}")
    
    # Match the curl command: -F "image=@/path/to/file"
    # Let requests handle Content-Type automatically for multipart
    with open(filepath, "rb") as f:
        files = {"image": (filename, f)}
        response = requests.post(OCR_URL, files=files, timeout=30)
    
    print(f"Response status: {response.status_code}")
    print(f"Response headers: {dict(response.headers)}")
    
    assert response.status_code == 200, f"Failed for {filename}: {response.text}"
    
    data = response.json()
    print(f"Full response JSON: {data}")
    
    # Check the correct field name in response
    extracted_text = data.get("extractedText", data.get("text", "")).lower()
    print(f"Extracted text: '{extracted_text}'")
    print(f"Extracted text length: {len(extracted_text)}")
    
    for word in words:
        print(f"Looking for '{word}' in '{extracted_text}'")
        assert word in extracted_text, f"Word '{word}' not found in OCR result for {filename}. Expected words: {words}, Got text: '{extracted_text}'"
