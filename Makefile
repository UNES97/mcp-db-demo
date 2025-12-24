# APM Terminal MCP Server - Makefile
# Simplified Docker commands

.PHONY: help build up down restart logs ps clean rebuild backup restore shell mysql-shell health

# Default target
.DEFAULT_GOAL := help

# Colors for output
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

help: ## Show this help message
	@echo "$(BLUE)APM Terminal MCP Server - Docker Commands$(NC)"
	@echo ""
	@echo "$(GREEN)Available commands:$(NC)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(YELLOW)%-15s$(NC) %s\n", $$1, $$2}'
	@echo ""

build: ## Build Docker images
	@echo "$(BLUE)Building Docker images...$(NC)"
	docker-compose build

up: ## Start all services
	@echo "$(BLUE)Starting services...$(NC)"
	docker-compose up -d
	@echo "$(GREEN)Services started! Access at http://localhost:3000$(NC)"

down: ## Stop all services
	@echo "$(BLUE)Stopping services...$(NC)"
	docker-compose down

restart: ## Restart all services
	@echo "$(BLUE)Restarting services...$(NC)"
	docker-compose restart

logs: ## Show logs (follow mode)
	docker-compose logs -f

logs-app: ## Show application logs only
	docker-compose logs -f app

logs-mysql: ## Show MySQL logs only
	docker-compose logs -f mysql

ps: ## Show running containers
	docker-compose ps

health: ## Check service health
	@echo "$(BLUE)Checking service health...$(NC)"
	@docker-compose ps
	@echo ""
	@echo "$(BLUE)Application health:$(NC)"
	@curl -s http://localhost:3000/api/health | python3 -m json.tool || echo "$(RED)Application not responding$(NC)"

clean: ## Stop and remove containers, networks (keeps volumes)
	@echo "$(YELLOW)Stopping and removing containers...$(NC)"
	docker-compose down
	@echo "$(GREEN)Cleanup complete (data volumes preserved)$(NC)"

clean-all: ## Stop and remove everything including volumes (WARNING: deletes data)
	@echo "$(RED)WARNING: This will delete all data!$(NC)"
	@read -p "Are you sure? (y/N) " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker-compose down -v; \
		echo "$(GREEN)Complete cleanup done$(NC)"; \
	else \
		echo "$(YELLOW)Cancelled$(NC)"; \
	fi

rebuild: ## Rebuild and restart services
	@echo "$(BLUE)Rebuilding and restarting...$(NC)"
	docker-compose up -d --build

rebuild-app: ## Rebuild only the application
	@echo "$(BLUE)Rebuilding application...$(NC)"
	docker-compose up -d --build app

backup: ## Backup MySQL database
	@echo "$(BLUE)Backing up database...$(NC)"
	@mkdir -p backups
	docker-compose exec -T mysql mysqldump -u root -proot apm_terminal > backups/apm_terminal_$$(date +%Y%m%d_%H%M%S).sql
	@echo "$(GREEN)Backup saved to backups/$(NC)"

restore: ## Restore MySQL database (use: make restore FILE=backup.sql)
	@if [ -z "$(FILE)" ]; then \
		echo "$(RED)ERROR: Please specify FILE parameter$(NC)"; \
		echo "Usage: make restore FILE=backups/backup.sql"; \
		exit 1; \
	fi
	@echo "$(BLUE)Restoring database from $(FILE)...$(NC)"
	docker-compose exec -T mysql mysql -u root -proot apm_terminal < $(FILE)
	@echo "$(GREEN)Database restored$(NC)"

shell: ## Open shell in application container
	docker-compose exec app sh

mysql-shell: ## Open MySQL shell
	docker-compose exec mysql mysql -u apm_user -papm_password apm_terminal

mysql-root: ## Open MySQL shell as root
	docker-compose exec mysql mysql -u root -proot apm_terminal

dev: ## Start services and show logs
	docker-compose up

install: ## Initial setup (copy .env, build, start)
	@echo "$(BLUE)Initial setup...$(NC)"
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "$(YELLOW)Created .env file. Please edit it with your API keys!$(NC)"; \
		echo "$(YELLOW)Edit .env and then run 'make up'$(NC)"; \
	else \
		echo "$(GREEN).env file already exists$(NC)"; \
		docker-compose build; \
		docker-compose up -d; \
		echo "$(GREEN)Setup complete! Access at http://localhost:3000$(NC)"; \
	fi

reset-db: ## Reset database to initial state
	@echo "$(RED)WARNING: This will reset the database!$(NC)"
	@read -p "Are you sure? (y/N) " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker-compose down; \
		docker volume rm mcp_mysql_data || true; \
		docker-compose up -d; \
		echo "$(GREEN)Database reset complete$(NC)"; \
	else \
		echo "$(YELLOW)Cancelled$(NC)"; \
	fi

update: ## Pull latest changes and rebuild
	@echo "$(BLUE)Updating application...$(NC)"
	git pull
	docker-compose up -d --build
	@echo "$(GREEN)Update complete$(NC)"

prune: ## Clean up unused Docker resources
	@echo "$(YELLOW)Cleaning up Docker resources...$(NC)"
	docker system prune -f
	@echo "$(GREEN)Cleanup complete$(NC)"

stats: ## Show Docker resource usage
	docker stats --no-stream
