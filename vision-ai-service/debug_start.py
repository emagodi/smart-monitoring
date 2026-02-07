
try:
    print("Importing main...")
    from main import app
    print("Import successful.")
    import uvicorn
    print("Starting uvicorn...")
    uvicorn.run(app, host="127.0.0.1", port=8000)
except Exception as e:
    print(f"Error: {e}")
