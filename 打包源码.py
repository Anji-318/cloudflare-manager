#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
智能源码打包工具 v2
自动识别项目类型与版本号，智能排除构建输出、敏感文件和大文件
用法:
  python 打包源码.py                  # 打包当前目录，版本号自动识别
  python 打包源码.py 1.2.3            # 指定版本号
  python 打包源码.py 1.2.3 D:\\proj   # 打包指定目录
  python 打包源码.py D:\\proj         # 打包指定目录，版本号自动识别
"""

import sys
import os
import zipfile
import fnmatch
import re
from pathlib import Path

# Windows 控制台 UTF-8 输出支持
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# ========== 排除规则 ==========

# 构建输出 / 依赖目录（按目录名匹配，不区分大小写）
EXCLUDE_DIRS = {
    # 版本控制与 IDE
    '.git', '.gradle', '.idea', '.kotlin', '.vs', '.vscode_cache',
    # 依赖与虚拟环境
    'node_modules', '.venv', '.nox', '.tox', '__pycache__', '.pytest_cache',
    '.mypy_cache', '.ruff_cache', '.pnpm-store',
    # 构建输出（跨语言通用）
    'target', 'build', 'dist', 'out', 'bin', 'obj', 'release', 'debug',
    'coverage', '.next', '.nuxt', '.output', '.svelte-kit', '.turbo',
    '.parcel-cache', '.nyc_output', '.cache',
    # 移动端 / 原生
    '.externalnativebuild', '.cxx', 'captures', 'generated', 'deriveddata',
    'pods',
    # 其他
    'captures',
}

# 需要保留的隐藏目录（CI 配置 / 编辑器配置等，默认其他隐藏目录一律排除）
KEEP_HIDDEN_DIRS = {
    '.github', '.gitee', '.vscode', '.devcontainer', '.well-known',
}

# 文件名排除（不区分大小写）
EXCLUDE_PATTERNS = [
    # 归档与压缩包
    '*.apk', '*.aab', '*.ap_', '*.zip', '*.tar.gz', '*.tar', '*.rar', '*.7z',
    '*.gz', '*.bz2', '*.xz',
    # 日志与临时文件
    '*.log', '*.tmp', '*.bak', '*.swp', '*.orig', '*~', '*.pid',
    # 系统垃圾文件
    '.DS_Store', 'Thumbs.db', 'desktop.ini',
    # 编译产物
    '*.class', '*.dex', '*.o', '*.so', '*.dll', '*.exe', '*.obj', '*.pdb',
    '*.idb', '*.ilk', '*.pch',
    # 签名与密钥（防泄漏）
    '*.jks', '*.keystore', '*.p12', '*.pfx', '*.pem', '*.key', '*.ppk',
    '*.kdbx', 'id_rsa', 'id_dsa', 'id_ecdsa', 'id_ed25519', '*_rsa', '*_ed25519',
    '*-key.txt', 'local.properties', 'credentials.json', '*.credentials',
    '.htpasswd',
    # 媒体与字体原文件（体积大且非源码）
    '*.psd', '*.ai', '*.sketch', '*.xd',
]

# .env 类敏感文件：排除，但保留示例模板
ENV_EXCLUDE = ('.env',)
ENV_EXCLUDE_PREFIX = '.env.'
ENV_KEEP = {'.env.example', '.env.sample', '.env.template', '.env.dist'}

# 工具自身
EXCLUDE_FILES = {
    '打包源码.py', '打包源码.bat', '生成图标.py', '生成图标.bat',
}

# 大文件阈值：超过即排除（不管是否二进制，源码文本极少超过此值）
LARGE_FILE_LIMIT = 10 * 1024 * 1024


# ========== 智能识别 ==========

def detect_project_types(root: Path):
    """识别项目类型（可同时命中多个）"""
    checks = [
        ('Tauri 桌面应用', (root / 'src-tauri' / 'tauri.conf.json').exists()),
        ('Node.js', (root / 'package.json').exists()),
        ('Rust', (root / 'Cargo.toml').exists()),
        ('Android / Gradle', bool(list(root.glob('*.gradle')) + list(root.glob('*.gradle.kts')))),
        ('C# / .NET', bool(list(root.glob('*.csproj')) + list(root.glob('*.sln')))),
        ('Python', (root / 'pyproject.toml').exists() or (root / 'requirements.txt').exists()
                   or (root / 'setup.py').exists()),
        ('Flutter / Dart', (root / 'pubspec.yaml').exists()),
        ('Go', (root / 'go.mod').exists()),
        ('Java / Maven', (root / 'pom.xml').exists()),
        ('C / C++ (CMake)', (root / 'CMakeLists.txt').exists()),
        ('静态网页', (root / 'index.html').exists() and not (root / 'package.json').exists()),
    ]
    return [name for name, ok in checks if ok]


def get_version(root: Path) -> str:
    """自动读取版本号，支持多种项目类型（按常见度排序）"""
    patterns = [
        # (路径, 正则, 描述)
        ('package.json',        r'"version"\s*:\s*"([^"]+)"', None),
        ('src-tauri/Cargo.toml', r'^version\s*=\s*"([^"]+)"', re.MULTILINE),
        ('src-tauri/tauri.conf.json', r'"version"\s*:\s*"([^"]+)"', None),
        ('pyproject.toml',      r'^version\s*=\s*"([^"]+)"', re.MULTILINE),
        ('setup.py',            r'version\s*=\s*["\']([^"\']+)["\']', None),
        ('pubspec.yaml',        r'^\s*version\s*:\s*([\w.+-]+)', re.MULTILINE),
        ('CMakeLists.txt',      r'project\s*\([^)]*?VERSION\s+([\w.+-]+)', None),
        ('VERSION',             r'([\w.+-]+)', None),
        ('app/build.gradle.kts', r'versionName\s*=\s*"([^"]+)"', None),
        ('build.gradle.kts',    r'versionName\s*=\s*"([^"]+)"', None),
        ('app/build.gradle',    r'versionName\s+["\']([^"\']+)["\']', None),
        ('build.gradle',        r'versionName\s+["\']([^"\']+)["\']', None),
        ('src/app.js',          r"APP_VERSION\s*=\s*'([^']+)'", None),
    ]
    for rel, pattern, flags in patterns:
        p = root / rel
        if not p.exists() or not p.is_file():
            continue
        try:
            content = p.read_text(encoding='utf-8', errors='ignore')
            m = re.search(pattern, content, flags or 0)
            if m:
                return m.group(1)
        except Exception:
            continue
    return "unknown"


# ========== 排除判断 ==========

def should_exclude_dir(name: str) -> bool:
    """目录是否应排除（剪枝用，只拿到目录名）"""
    lower = name.lower()
    if lower in EXCLUDE_DIRS:
        return True
    # 隐藏目录默认排除，白名单除外
    if name.startswith('.') and lower not in KEEP_HIDDEN_DIRS:
        return True
    return False


def should_exclude_file(path: Path, root: Path, zip_name: str) -> bool:
    """文件是否应排除"""
    name = path.name

    # 输出包自身与工具自身
    if name == zip_name or name in EXCLUDE_FILES:
        return True

    # .env 类：排除 .env / .env.xxx，但保留 .env.example 等模板
    lower = name.lower()
    if lower in ENV_EXCLUDE or (lower.startswith(ENV_EXCLUDE_PREFIX) and lower not in ENV_KEEP):
        return True

    # 文件名模式（不区分大小写）
    for pattern in EXCLUDE_PATTERNS:
        if fnmatch.fnmatch(lower, pattern.lower()):
            return True

    # 大文件直接排除（不做二进制探测，避免误判）
    try:
        if path.stat().st_size > LARGE_FILE_LIMIT:
            return True
    except OSError:
        return True  # 无法 stat（如损坏的符号链接），跳过

    return False


# ========== 打包 ==========

def collect_files(root: Path, zip_name: str):
    """遍历收集文件（walk 时原地剪枝，不进入排除目录）"""
    files = []
    stats = {'sensitive': 0, 'large': 0, 'pattern': 0}

    for dirpath, dirnames, filenames in os.walk(root):
        # 原地修改 dirnames 实现剪枝：不进入排除目录
        dirnames[:] = [d for d in dirnames if not should_exclude_dir(d)]
        for fn in filenames:
            p = Path(dirpath) / fn
            # 跳过非常规文件（管道、设备、损坏的符号链接等）
            try:
                if not p.is_file():
                    continue
            except OSError:
                continue
            lower = fn.lower()
            if lower in ENV_EXCLUDE or (lower.startswith(ENV_EXCLUDE_PREFIX) and lower not in ENV_KEEP):
                stats['sensitive'] += 1
                continue
            try:
                if p.stat().st_size > LARGE_FILE_LIMIT:
                    stats['large'] += 1
                    continue
            except OSError:
                continue
            if fnmatch.fnmatch(lower, '*') and (fn in EXCLUDE_FILES or fn == zip_name):
                continue
            excluded = False
            for pattern in EXCLUDE_PATTERNS:
                if fnmatch.fnmatch(lower, pattern.lower()):
                    stats['pattern'] += 1
                    excluded = True
                    break
            if excluded:
                continue
            files.append(p)

    files.sort(key=lambda x: str(x.relative_to(root)))
    return files, stats


def pack_source(version: str, root: Path):
    root = root.resolve()
    project_name = root.name
    zip_name = f"{project_name}-v{version}-src.zip"

    print("=" * 44)
    print(f"  {project_name} 源码打包")
    print(f"  版本: {version}")
    types = detect_project_types(root)
    if types:
        print(f"  识别到项目类型: {' + '.join(types)}")
    print("=" * 44)
    print()

    if not root.is_dir():
        print(f"[错误] 目录不存在: {root}")
        sys.exit(1)

    out_path = root / zip_name
    if out_path.exists():
        os.remove(out_path)

    print(f"[扫描] {root}")
    all_files, stats = collect_files(root, zip_name)
    print(f"  敏感文件排除: {stats['sensitive']} 个")
    print(f"  大文件排除(>{LARGE_FILE_LIMIT // 1024 // 1024}MB): {stats['large']} 个")
    print(f"  其他规则排除: {stats['pattern']} 个")
    print()

    print(f"[打包] 正在生成 {zip_name} ...")
    count = 0
    total_size = 0
    with zipfile.ZipFile(out_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for item in all_files:
            rel_path = item.relative_to(root)
            try:
                zf.write(item, rel_path)
                count += 1
                total_size += item.stat().st_size
            except Exception as e:
                print(f"  [跳过] {rel_path}: {e}")

    final_size = out_path.stat().st_size
    print(f"[成功] 源码包已生成: {zip_name}")
    print(f"       文件数: {count}")
    print(f"       原始大小: {total_size / 1024:.1f} KB")
    print(f"       压缩后: {final_size / 1024:.1f} KB")
    print()


def main():
    args = sys.argv[1:]
    version = None
    target = None
    for arg in args:
        p = Path(arg)
        if p.exists() and p.is_dir():
            target = p
        else:
            version = arg

    root = (target or Path('.')).resolve()
    if version is None:
        version = get_version(root)

    pack_source(version, root)

    if sys.stdin.isatty():
        print("按 Enter 键退出...")
        try:
            input()
        except EOFError:
            pass


if __name__ == "__main__":
    main()
