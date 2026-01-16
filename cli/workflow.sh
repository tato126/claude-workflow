#!/bin/bash

# Workflow CLI
# Usage: workflow <command> [options]

WORKFLOW_DIR="$HOME/.claude/workflow"
DAEMON_DIR="$WORKFLOW_DIR/daemon"
DATA_DIR="$WORKFLOW_DIR/data"
PID_FILE="$WORKFLOW_DIR/daemon.pid"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_banner() {
    echo -e "${BLUE}"
    echo "╔═══════════════════════════════════════════╗"
    echo "║      Workflow Automation CLI v1.0         ║"
    echo "╚═══════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_help() {
    print_banner
    echo "Usage: workflow <command> [options]"
    echo ""
    echo "Commands:"
    echo "  start                    Start the daemon"
    echo "  stop                     Stop the daemon"
    echo "  status                   Show daemon status"
    echo "  restart                  Restart the daemon"
    echo ""
    echo "  project add <path>       Register a project"
    echo "  project list             List registered projects"
    echo "  project remove <name>    Remove a project"
    echo ""
    echo "  add <prompt>             Add a task to current project"
    echo "    --project <name>       Specify project"
    echo "    --type <type>          Task type (feature|bugfix|refactor)"
    echo "    --skill <skill>        Skill to use"
    echo ""
    echo "  list [--project <name>]  List tasks"
    echo "  logs <task-id>           Show task logs"
    echo ""
    echo "  web                      Open web UI"
    echo ""
}

# Daemon commands
daemon_start() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p $PID > /dev/null 2>&1; then
            echo -e "${YELLOW}Daemon is already running (PID: $PID)${NC}"
            return 1
        fi
    fi

    echo -e "${BLUE}Starting daemon...${NC}"
    cd "$DAEMON_DIR"
    npm run dev > "$WORKFLOW_DIR/logs/daemon.log" 2>&1 &
    echo $! > "$PID_FILE"
    echo -e "${GREEN}✅ Daemon started (PID: $!)${NC}"
}

daemon_stop() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p $PID > /dev/null 2>&1; then
            echo -e "${BLUE}Stopping daemon (PID: $PID)...${NC}"
            kill $PID
            rm "$PID_FILE"
            echo -e "${GREEN}✅ Daemon stopped${NC}"
            return 0
        fi
    fi
    echo -e "${YELLOW}Daemon is not running${NC}"
}

daemon_status() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p $PID > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Daemon is running (PID: $PID)${NC}"

            # Show stats
            REGISTRY="$DATA_DIR/registry.json"
            if [ -f "$REGISTRY" ]; then
                PROJECT_COUNT=$(cat "$REGISTRY" | grep -o '"path"' | wc -l | tr -d ' ')
                echo -e "   Projects: $PROJECT_COUNT"
            fi

            # Count todo tasks
            TODO_COUNT=0
            PROGRESS_COUNT=0

            return 0
        fi
    fi
    echo -e "${RED}❌ Daemon is not running${NC}"
}

# Project commands
project_add() {
    local PROJECT_PATH="$1"

    if [ -z "$PROJECT_PATH" ]; then
        echo -e "${RED}Error: Project path required${NC}"
        echo "Usage: workflow project add <path>"
        return 1
    fi

    # Resolve to absolute path
    PROJECT_PATH=$(cd "$PROJECT_PATH" 2>/dev/null && pwd)

    if [ -z "$PROJECT_PATH" ]; then
        echo -e "${RED}Error: Invalid path${NC}"
        return 1
    fi

    PROJECT_NAME=$(basename "$PROJECT_PATH")

    # Create project structure
    mkdir -p "$PROJECT_PATH/.claude/tasks/archive"
    mkdir -p "$PROJECT_PATH/.claude/logs"
    mkdir -p "$PROJECT_PATH/.claude/skills"
    mkdir -p "$PROJECT_PATH/.claude/docs/changes"
    mkdir -p "$PROJECT_PATH/.claude/docs/features"

    # Initialize queue.json
    echo "{\"project\": \"$PROJECT_PATH\", \"tasks\": []}" > "$PROJECT_PATH/.claude/tasks/queue.json"

    # Add to registry
    REGISTRY="$DATA_DIR/registry.json"
    TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    # Use node to update JSON
    node -e "
        const fs = require('fs');
        const registry = JSON.parse(fs.readFileSync('$REGISTRY', 'utf-8'));

        // Check if already exists
        if (registry.projects.some(p => p.path === '$PROJECT_PATH')) {
            console.log('Project already registered');
            process.exit(0);
        }

        registry.projects.push({
            name: '$PROJECT_NAME',
            path: '$PROJECT_PATH',
            addedAt: '$TIMESTAMP'
        });

        fs.writeFileSync('$REGISTRY', JSON.stringify(registry, null, 2));
        console.log('Project added successfully');
    "

    echo -e "${GREEN}✅ Project added: $PROJECT_NAME${NC}"
    echo -e "   Path: $PROJECT_PATH"
}

project_list() {
    REGISTRY="$DATA_DIR/registry.json"

    if [ ! -f "$REGISTRY" ]; then
        echo -e "${YELLOW}No projects registered${NC}"
        return 0
    fi

    echo -e "${BLUE}Registered Projects:${NC}"
    echo ""

    node -e "
        const fs = require('fs');
        const registry = JSON.parse(fs.readFileSync('$REGISTRY', 'utf-8'));

        if (registry.projects.length === 0) {
            console.log('  No projects registered');
            console.log('  Use: workflow project add <path>');
            process.exit(0);
        }

        registry.projects.forEach((p, i) => {
            console.log('  ' + (i + 1) + '. ' + p.name);
            console.log('     Path: ' + p.path);

            // Count tasks
            try {
                const queue = JSON.parse(fs.readFileSync(p.path + '/.claude/tasks/queue.json', 'utf-8'));
                const todo = queue.tasks.filter(t => t.status === 'todo').length;
                const progress = queue.tasks.filter(t => t.status === 'progress').length;
                const review = queue.tasks.filter(t => t.status === 'review').length;
                const done = queue.tasks.filter(t => t.status === 'done').length;
                console.log('     Tasks: ' + todo + ' todo, ' + progress + ' progress, ' + review + ' review, ' + done + ' done');
            } catch (e) {
                console.log('     Tasks: -');
            }
            console.log('');
        });
    "
}

project_remove() {
    local PROJECT_NAME="$1"

    if [ -z "$PROJECT_NAME" ]; then
        echo -e "${RED}Error: Project name required${NC}"
        return 1
    fi

    REGISTRY="$DATA_DIR/registry.json"

    node -e "
        const fs = require('fs');
        const registry = JSON.parse(fs.readFileSync('$REGISTRY', 'utf-8'));

        const index = registry.projects.findIndex(p => p.name === '$PROJECT_NAME');
        if (index === -1) {
            console.log('Project not found: $PROJECT_NAME');
            process.exit(1);
        }

        registry.projects.splice(index, 1);
        fs.writeFileSync('$REGISTRY', JSON.stringify(registry, null, 2));
        console.log('Project removed: $PROJECT_NAME');
    "
}

# Task commands
task_add() {
    local PROMPT="$1"
    local PROJECT=""
    local TYPE="feature"
    local SKILL=""

    shift
    while [[ $# -gt 0 ]]; do
        case $1 in
            --project)
                PROJECT="$2"
                shift 2
                ;;
            --type)
                TYPE="$2"
                shift 2
                ;;
            --skill)
                SKILL="$2"
                shift 2
                ;;
            *)
                shift
                ;;
        esac
    done

    if [ -z "$PROMPT" ]; then
        echo -e "${RED}Error: Prompt required${NC}"
        echo "Usage: workflow add \"prompt\" [--project name] [--type feature|bugfix|refactor]"
        return 1
    fi

    # If no project specified, use current directory
    if [ -z "$PROJECT" ]; then
        PROJECT=$(pwd)
    fi

    # Find project path
    REGISTRY="$DATA_DIR/registry.json"
    PROJECT_PATH=$(node -e "
        const fs = require('fs');
        const registry = JSON.parse(fs.readFileSync('$REGISTRY', 'utf-8'));
        const project = registry.projects.find(p => p.name === '$PROJECT' || p.path === '$PROJECT');
        if (project) console.log(project.path);
    ")

    if [ -z "$PROJECT_PATH" ]; then
        echo -e "${RED}Error: Project not found. Register it first with: workflow project add <path>${NC}"
        return 1
    fi

    # Generate task ID
    TASK_ID="task-$(date +%Y%m%d)-$(openssl rand -hex 3)"
    TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

    # Add task to queue
    QUEUE_FILE="$PROJECT_PATH/.claude/tasks/queue.json"

    node -e "
        const fs = require('fs');
        const queue = JSON.parse(fs.readFileSync('$QUEUE_FILE', 'utf-8'));

        queue.tasks.push({
            id: '$TASK_ID',
            title: '$PROMPT'.substring(0, 50) + ('$PROMPT'.length > 50 ? '...' : ''),
            prompt: '$PROMPT',
            type: '$TYPE',
            skill: '$SKILL' || undefined,
            validation: ['test', 'lint'],
            status: 'todo',
            retry: { max: 3, current: 0 },
            createdAt: '$TIMESTAMP'
        });

        fs.writeFileSync('$QUEUE_FILE', JSON.stringify(queue, null, 2));
    "

    echo -e "${GREEN}✅ Task added: $TASK_ID${NC}"
    echo -e "   Project: $(basename $PROJECT_PATH)"
    echo -e "   Type: $TYPE"
    echo -e "   Prompt: ${PROMPT:0:50}..."
}

task_list() {
    local PROJECT=""

    while [[ $# -gt 0 ]]; do
        case $1 in
            --project)
                PROJECT="$2"
                shift 2
                ;;
            *)
                shift
                ;;
        esac
    done

    REGISTRY="$DATA_DIR/registry.json"

    node -e "
        const fs = require('fs');
        const registry = JSON.parse(fs.readFileSync('$REGISTRY', 'utf-8'));

        const projects = '$PROJECT'
            ? registry.projects.filter(p => p.name === '$PROJECT' || p.path === '$PROJECT')
            : registry.projects;

        for (const project of projects) {
            console.log('\n📁 ' + project.name);
            console.log('─'.repeat(40));

            try {
                const queue = JSON.parse(fs.readFileSync(project.path + '/.claude/tasks/queue.json', 'utf-8'));

                const statusOrder = ['todo', 'progress', 'review', 'done', 'failed'];
                const statusIcons = {
                    todo: '📋',
                    progress: '⚡',
                    review: '🔍',
                    done: '✅',
                    failed: '❌'
                };

                for (const status of statusOrder) {
                    const tasks = queue.tasks.filter(t => t.status === status);
                    if (tasks.length > 0) {
                        console.log('\n' + statusIcons[status] + ' ' + status.toUpperCase() + ' (' + tasks.length + ')');
                        for (const task of tasks) {
                            console.log('   • ' + task.id + ': ' + task.title);
                        }
                    }
                }

                if (queue.tasks.length === 0) {
                    console.log('   No tasks');
                }
            } catch (e) {
                console.log('   Error reading queue');
            }
        }
    "
}

# Web UI
open_web() {
    WEB_DIR="$WORKFLOW_DIR/web"

    if [ ! -f "$WEB_DIR/package.json" ]; then
        echo -e "${YELLOW}Web UI not installed. Installing...${NC}"
        # This will be handled later
        return 1
    fi

    echo -e "${BLUE}Opening Web UI...${NC}"
    cd "$WEB_DIR"
    npm run dev &
    sleep 3
    open "http://localhost:3000"
}

# Main
case "$1" in
    start)
        daemon_start
        ;;
    stop)
        daemon_stop
        ;;
    status)
        daemon_status
        ;;
    restart)
        daemon_stop
        sleep 1
        daemon_start
        ;;
    project)
        case "$2" in
            add)
                project_add "$3"
                ;;
            list)
                project_list
                ;;
            remove)
                project_remove "$3"
                ;;
            *)
                echo "Usage: workflow project <add|list|remove>"
                ;;
        esac
        ;;
    add)
        shift
        task_add "$@"
        ;;
    list)
        shift
        task_list "$@"
        ;;
    web)
        open_web
        ;;
    help|--help|-h)
        print_help
        ;;
    *)
        print_help
        ;;
esac
