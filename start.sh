#!/bin/bash

echo "--- Debugging Start ---"
echo "Current Directory: $(pwd)"

# Check if Backend exists before moving
if [ -d "Backend" ]; then
    echo "Found Backend folder."
    cd Backend
else
    echo "ERROR: Backend folder not found in $(pwd)"
    exit 1
fi

# Check for uv
if ! command -v uv &> /dev/null; then
    echo "uv not found. Installing..."

    curl -LsSf https://astral.sh/uv/install.sh | sh

    # Try to make it available in this session
    export PATH="$HOME/.cargo/bin:$PATH"

    # Verify installation
    if ! command -v uv &> /dev/null; then
        echo "ERROR: uv installation failed or not in PATH."
        echo "Try restarting your shell or installing manually."
        exit 1
    fi

    echo "uv installed successfully."
else
    echo "uv is already installed."
fi

echo "Running uv sync..."
uv sync

echo "Running setup scripts..."
python generate_signing_key.py
python seed_zambia.py

echo "Starting FastAPI..."
uvicorn main:app --host 0.0.0.0 --port 8000 &

echo "Starting Django..."
python manage.py runserver 8001 &

# Optional: Frontend check
cd ..
if [ -d "Frontend" ]; then
    echo "Found Frontend. Starting..."
    cd Frontend
    pnpm dev &
else
    echo "Frontend folder not found, skipping."
fi

echo "All processes started. Press Ctrl+C to stop."
wait