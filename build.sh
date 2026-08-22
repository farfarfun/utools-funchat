#!/bin/bash

# 构建 frontend-main
echo "=== build funchat frontend main ==="
cd frontend-main
pnpm install
if [ $? -ne 0 ]; then
    echo "frontend-main install error"
    exit 1
fi
pnpm build
if [ $? -ne 0 ]; then
    echo "frontend-main build error"
    exit 1
fi
cd ..

# 构建 frontend-window
echo ""
echo "=== build frontend-window ==="
cd frontend-window
pnpm install
if [ $? -ne 0 ]; then
    echo "frontend-window install error"
    exit 1
fi
pnpm build
if [ $? -ne 0 ]; then
    echo "frontend-window build error"
    exit 1
fi
cd ..

# 构建 backend
echo ""
echo "=== build backend ==="
cd backend
pnpm install
if [ $? -ne 0 ]; then
    echo "backend install error"
    exit 1
fi
pnpm build
if [ $? -ne 0 ]; then
    echo "backend build error"
    exit 1
fi
cd ..

# 运行 Python 脚本移动文件
echo ""
echo "=== run Python : moveDist.py ==="
python moveDist.py
