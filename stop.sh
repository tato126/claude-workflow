#!/bin/bash

# Workflow System Stopper
# 모든 컴포넌트를 중지합니다

WORKFLOW_DIR="$HOME/.claude/workflow"

echo "Stopping Workflow services..."

# Stop Daemon
if [ -f "$WORKFLOW_DIR/daemon.pid" ]; then
    DAEMON_PID=$(cat "$WORKFLOW_DIR/daemon.pid")
    if ps -p $DAEMON_PID > /dev/null 2>&1; then
        kill $DAEMON_PID 2>/dev/null
        echo "✅ Daemon stopped"
    fi
    rm -f "$WORKFLOW_DIR/daemon.pid"
fi

# Stop Web UI (find by port)
WEB_PID=$(lsof -ti:3002 2>/dev/null)
if [ -n "$WEB_PID" ]; then
    kill $WEB_PID 2>/dev/null
    echo "✅ Web UI stopped"
fi

echo ""
echo "All services stopped."
