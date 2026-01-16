#!/bin/bash

# Workflow System Starter
# 모든 컴포넌트를 시작합니다

WORKFLOW_DIR="$HOME/.claude/workflow"

echo "╔═══════════════════════════════════════════╗"
echo "║     Workflow Automation System            ║"
echo "╚═══════════════════════════════════════════╝"
echo ""

# Start Web UI
echo "🌐 Starting Web UI..."
cd "$WORKFLOW_DIR/web"
npm run dev > "$WORKFLOW_DIR/logs/web.log" 2>&1 &
WEB_PID=$!
echo "   Web UI started (PID: $WEB_PID)"

# Wait for Web UI to start
sleep 3

# Start Daemon
echo "⚡ Starting Daemon..."
cd "$WORKFLOW_DIR/daemon"
npm run dev > "$WORKFLOW_DIR/logs/daemon.log" 2>&1 &
DAEMON_PID=$!
echo $DAEMON_PID > "$WORKFLOW_DIR/daemon.pid"
echo "   Daemon started (PID: $DAEMON_PID)"

echo ""
echo "✅ All services started!"
echo ""
echo "📍 Web UI: http://localhost:3002"
echo "📋 Logs: $WORKFLOW_DIR/logs/"
echo ""
echo "To stop: $WORKFLOW_DIR/stop.sh"
