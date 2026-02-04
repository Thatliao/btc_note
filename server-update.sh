#!/bin/bash

# BTC Price Alert 服务器端更新脚本

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

cd ~/btc_note

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}    BTC Price Alert 服务器更新${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

echo -e "${YELLOW}1. 拉取最新代码...${NC}"
git pull

echo ""
echo -e "${YELLOW}2. 安装依赖...${NC}"
npm install

echo ""
echo -e "${YELLOW}3. 编译 TypeScript...${NC}"
npm run build

echo ""
echo -e "${YELLOW}4. 重启服务...${NC}"
pm2 restart btc-alert

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}    更新完成!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

echo -e "${CYAN}查看日志: ${NC}pm2 logs btc-alert"
echo -e "${CYAN}查看状态: ${NC}pm2 status"
