#!/bin/bash

# BTC Price Alert Git 自动提交脚本

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 切换到脚本所在目录
SCRIPT_DIR="$(dirname "$0")"
cd "$SCRIPT_DIR"

# 配置文件路径
CONFIG_FILE="$SCRIPT_DIR/.git-config.local"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}    BTC Price Alert Git 工具${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 读取配置
load_config() {
    if [ -f "$CONFIG_FILE" ]; then
        source "$CONFIG_FILE"
        return 0
    fi
    return 1
}

# 保存配置
save_config() {
    cat > "$CONFIG_FILE" << EOF
# Git 本地配置 (请勿提交此文件)
GIT_USERNAME="$GIT_USERNAME"
GIT_EMAIL="$GIT_EMAIL"
GIT_REMOTE_URL="$GIT_REMOTE_URL"
GIT_BRANCH="$GIT_BRANCH"
EOF
    chmod 600 "$CONFIG_FILE"
    echo -e "${GREEN}配置已保存到 .git-config.local${NC}"
}

# 首次配置
setup_config() {
    echo -e "${CYAN}========== 首次配置 ==========${NC}"
    echo ""
    read -p "Git 用户名: " GIT_USERNAME
    read -p "Git 邮箱: " GIT_EMAIL
    echo -e "${YELLOW}远程仓库 URL 格式:${NC}"
    echo "  SSH:   git@github.com:用户名/仓库名.git"
    read -p "远程仓库 URL [git@github.com:Thatliao/btc_note.git]: " GIT_REMOTE_URL
    GIT_REMOTE_URL=${GIT_REMOTE_URL:-git@github.com:Thatliao/btc_note.git}
    read -p "默认分支 [main]: " GIT_BRANCH
    GIT_BRANCH=${GIT_BRANCH:-main}
    echo ""
    save_config
    git config user.name "$GIT_USERNAME"
    git config user.email "$GIT_EMAIL"
    if ! git remote | grep -q "origin"; then
        git remote add origin "$GIT_REMOTE_URL"
    else
        git remote set-url origin "$GIT_REMOTE_URL"
    fi
    echo -e "${GREEN}配置完成${NC}"
    echo ""
}

# 显示当前配置
show_config() {
    echo -e "${CYAN}当前配置:${NC}"
    echo -e "  用户名: ${GREEN}$GIT_USERNAME${NC}"
    echo -e "  邮箱:   ${GREEN}$GIT_EMAIL${NC}"
    echo -e "  仓库:   ${GREEN}$GIT_REMOTE_URL${NC}"
    echo -e "  分支:   ${GREEN}$GIT_BRANCH${NC}"
    echo ""
}

# 主菜单
show_menu() {
    echo -e "${CYAN}请选择操作:${NC}"
    echo "  1) 提交并推送"
    echo "  2) 仅提交（不推送）"
    echo "  3) 继续推送（已提交未推送）"
    echo "  4) 查看状态"
    echo "  5) 拉取更新"
    echo "  6) 重新配置"
    echo "  0) 退出"
    echo ""
    read -p "选择 [1]: " choice
    choice=${choice:-1}
}

# 提交改动
do_commit() {
    echo -e "${YELLOW}改动文件:${NC}"
    git status --short
    echo ""
    if [ -z "$(git status --porcelain)" ]; then
        echo -e "${GREEN}没有需要提交的改动${NC}"
        return 1
    fi
    echo -e "${CYAN}请输入提交信息 (直接回车使用默认):${NC}"
    read -p "> " COMMIT_MSG
    if [ -z "$COMMIT_MSG" ]; then
        TIMESTAMP=$(date "+%Y-%m-%d %H:%M")
        COMMIT_MSG="更新 - $TIMESTAMP"
        echo -e "${YELLOW}使用默认: ${NC}$COMMIT_MSG"
    fi
    echo ""
    echo -e "${YELLOW}添加文件...${NC}"
    git add .
    echo -e "${YELLOW}提交改动...${NC}"
    git commit -m "$COMMIT_MSG"
    return 0
}

# 推送到远程
do_push() {
    echo ""
    echo -e "${YELLOW}推送到远程 ($GIT_BRANCH)...${NC}"
    push_output=$(git push origin "$GIT_BRANCH" 2>&1)
    push_result=$?

    if [ $push_result -eq 0 ]; then
        echo ""
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}    推送成功!${NC}"
        echo -e "${GREEN}========================================${NC}"
    else
        echo "$push_output"
        echo ""
        if echo "$push_output" | grep -q "fetch first\|non-fast-forward"; then
            echo -e "${YELLOW}检测到远程仓库有新的更改${NC}"
            echo -e "${CYAN}正在自动拉取并合并 (rebase)...${NC}"
            echo ""
            if git pull --rebase origin "$GIT_BRANCH"; then
                echo ""
                echo -e "${GREEN}拉取成功，正在重新推送...${NC}"
                if git push origin "$GIT_BRANCH"; then
                    echo ""
                    echo -e "${GREEN}========================================${NC}"
                    echo -e "${GREEN}    推送成功!${NC}"
                    echo -e "${GREEN}========================================${NC}"
                else
                    echo -e "${RED}推送仍然失败，请手动检查${NC}"
                fi
            else
                echo ""
                echo -e "${RED}拉取失败，可能存在冲突${NC}"
                echo -e "${YELLOW}请手动解决冲突后:${NC}"
                echo "  1. 解决冲突文件"
                echo "  2. git add ."
                echo "  3. git rebase --continue"
                echo "  4. 再次运行此脚本选择 3) 继续推送"
            fi
        else
            echo -e "${RED}推送失败${NC}"
            echo -e "${YELLOW}可能是网络问题，稍后再试选择 3) 继续推送${NC}"
        fi
    fi
}

# ========== 主流程 ==========

if [ ! -d ".git" ]; then
    echo -e "${YELLOW}未检测到 Git 仓库，正在初始化...${NC}"
    git init
    echo ""
fi

if ! load_config; then
    setup_config
else
    show_config
    if git remote | grep -q "origin"; then
        current_url=$(git remote get-url origin 2>/dev/null)
        if [ "$current_url" != "$GIT_REMOTE_URL" ]; then
            git remote set-url origin "$GIT_REMOTE_URL"
        fi
    fi
fi

show_menu

case $choice in
    1)
        if do_commit; then
            do_push
        fi
        ;;
    2)
        do_commit
        ;;
    3)
        echo -e "${YELLOW}继续推送已提交的更改...${NC}"
        do_push
        ;;
    4)
        echo -e "${YELLOW}当前状态:${NC}"
        git status
        echo ""
        echo -e "${YELLOW}未推送的提交:${NC}"
        git log origin/$GIT_BRANCH..HEAD --oneline 2>/dev/null || echo "无法获取（可能是首次推送）"
        ;;
    5)
        echo -e "${YELLOW}拉取更新...${NC}"
        git pull origin "$GIT_BRANCH"
        ;;
    6)
        setup_config
        ;;
    0)
        echo -e "${GREEN}再见!${NC}"
        exit 0
        ;;
    *)
        echo -e "${RED}无效选择${NC}"
        ;;
esac
