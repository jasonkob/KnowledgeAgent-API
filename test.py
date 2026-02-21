import requests

res = requests.post(
    "http://localhost:3000/api/chat",
    headers={"x-api-key": "dp_a5022a7f63b8439ba1e35a4bec7a83ac"},
    json={
        "message": "What is this document about?",
        "collectionName": "1_d2olpe"
    }
)
print(res.json()["answer"])