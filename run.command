#!/bin/bash
trap 'kill $(jobs -p)' EXIT
# Run Backend(GLIGEN)
cd /Users/amberdev31/stsk/25s
python app.py &
BACK_PID=$!
# Run Frontend(React)
cd illustelligence
npm run dev &
FRONT_PID=$!
# Open Webpage
sleep 5
open http://localhost:5173
wait $BACK_PID $FRONT_PID