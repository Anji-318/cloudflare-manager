#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
智能源码打包工具
自动识别项目类型，智能排除构建输出和敏感文件
用法: python 打包源码.py [版本号]
"""

import sys
import os
import zipfile
from pathlib import Path
import fnmatch
import re

# 智能排除规则
EXCLUDE_DIRS = {
    '.git', '.gradle', '.idea', '.kotlin', '.vs', '.cache', '.venv',
    '__pycache__', 'node_modules', 'target', 'build', 'release',
    '.externalNativeBuild', '.cxx', 'captures', 'generated',
}

EXCLUDE_PATTERNS = [
    '*.apk', '*.aab', '*.ap_', '*.zip', '*.tar.gz', '*.tar', '*.rar',
    '*.jks', '*-key.txt', 'local.properties', 'git-config.txt',
    '*.log', '*.tmp', '*.bak', '*.swp', '*.orig', '*~',
    '.DS_Store', 'Thumbs.db', 'desktop.ini',
    '*.class', '*.dex', '*.o', '*.so', '*.dll',
]

EXCLUDE_FILES = {
    '打包源码.py', '打包源码.bat', '生成图标.py', '生成图标.bat',
}


def is_binary_file(path: Path) -> bool:
    """检测是否为二进制文件"""
    try:
        with open(path, 'rb') as f:
            chunk = f.read(1024)
            if b'\x00' in chunk:
                return True
    except:
        pass
    return False


def should_exclude(path: Path, root: Path) -> bool:
    """智能判断文件是否应该被排除"""
    rel = path.relative_to(root)
    name = path.name
    
    # 检查是否在排除目录中
    for part in rel.parts[:-1]:
        if part.lower() in EXCLUDE_DIRS:
            return True
        if part.startswith('.'):
            return True
    
    # 检查文件名
    if name in EXCLUDE_FILES:
        return True
    
    for pattern in EXCLUDE_PATTERNS:
        if fnmatch.fnmatch(name, pattern):
            return True
    
    # 排除大文件（>10MB 的二进制文件，可能是模型/库）
    try:
        if path.stat().st_size > 10 * 1024 * 1024 and is_binary_file(path):
            return True
    except:
        pass
    
    return False


def get_version() -> str:
    """自动读取版本号"""
    # 尝试 build.gradle.kts
    for build_file in ['app/build.gradle.kts', 'build.gradle.kts']:
        p = Path(build_file)
        if p.exists():
            content = p.read_text(encoding='utf-8')
            m = re.search(r'versionName\s*=\s*"([^"]+)"', content)
            if m:
                return m.group(1)
    
    # 尝试 build.gradle
    for build_file in ['app/build.gradle', 'build.gradle']:
        p = Path(build_file)
        if p.exists():
            content = p.read_text(encoding='utf-8')
            m = re.search(r'versionName\s+["\']([^"\']+)["\']', content)
            if m:
                return m.group(1)
    
    return "unknown"


def pack_source(version: str):
    """打包源码"""
    root = Path('.').resolve()
    project_name = root.name
    zip_name = f"{project_name}-v{version}-src.zip"
    
    print("=" * 40)
    print(f"  {project_name} 源码打包")
    print(f"  版本: {version}")
    print("=" * 40)
    print()
    
    if Path(zip_name).exists():
        os.remove(zip_name)
    
    print(f"[打包] 正在生成 {zip_name} ...")
    print("  智能扫描当前目录，自动排除构建输出和敏感文件")
    print()
    
    # 收集所有文件
    all_files = []
    for item in root.rglob('*'):
        if item.is_dir():
            continue
        if should_exclude(item, root):
            continue
        all_files.append(item)
    
    # 按路径排序，确保目录结构清晰
    all_files.sort(key=lambda x: str(x.relative_to(root)))
    
    with zipfile.ZipFile(zip_name, 'w', zipfile.ZIP_DEFLATED) as zf:
        count = 0
        total_size = 0
        
        for item in all_files:
            rel_path = item.relative_to(root)
            try:
                zf.write(item, rel_path)
                count += 1
                total_size += item.stat().st_size
            except Exception as e:
                print(f"  [跳过] {rel_path}: {e}")
    
    final_size = Path(zip_name).stat().st_size
    print(f"[成功] 源码包已生成: {zip_name}")
    print(f"       文件数: {count}")
    print(f"       原始大小: {total_size / 1024:.1f} KB")
    print(f"       压缩后: {final_size / 1024:.1f} KB")
    print()


def main():
    if len(sys.argv) >= 2:
        version = sys.argv[1]
    else:
        version = get_version()
    
    pack_source(version)
    print("按 Enter 键退出...")
    try:
        input()
    except EOFError:
        pass


if __name__ == "__main__":
    main()
