from PyPDF2 import PdfReader
import re

pdf_path = "Repertório Louvor 2024-2.pdf"
reader = PdfReader(pdf_path)
text = ""
for page in reader.pages:
    text += page.extract_text() + "\n"
text = text.replace("ﬁ", "fi").replace("ﬂ", "fl")

print("--- TEXT START ---")
print(text[:1000])
print("--- TEXT END ---")

category_regex = re.compile(r"^([A-ZÀ-ÿ/ \-\d]+(?:\(.*\))?|“?[A-ZÀ-ÿ][a-zÀ-ÿ]+”?)\s*$", re.IGNORECASE | re.MULTILINE)
matches = category_regex.finditer(text)
for m in matches:
    print(f"Found Category: {m.group(1)}")
