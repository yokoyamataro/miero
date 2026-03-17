#!/usr/bin/env python3
"""
Native Messaging Host for Miero Folder Opener
Receives path from Chrome extension and opens it in Explorer
"""

import sys
import json
import struct
import subprocess
import os

def read_message():
    """Read a message from stdin"""
    raw_length = sys.stdin.buffer.read(4)
    if len(raw_length) == 0:
        return None
    message_length = struct.unpack("@I", raw_length)[0]
    message = sys.stdin.buffer.read(message_length).decode("utf-8")
    return json.loads(message)

def send_message(message):
    """Send a message to stdout"""
    encoded = json.dumps(message).encode("utf-8")
    sys.stdout.buffer.write(struct.pack("@I", len(encoded)))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()

def open_path(path):
    """Open a file or folder in Explorer"""
    try:
        # パスを正規化
        normalized_path = os.path.normpath(path)

        if os.path.isfile(normalized_path):
            # ファイルの場合: ファイルを選択した状態でエクスプローラーを開く
            subprocess.Popen(["explorer", "/select,", normalized_path])
        elif os.path.isdir(normalized_path):
            # フォルダの場合: フォルダを開く
            subprocess.Popen(["explorer", normalized_path])
        else:
            # パスが存在しない場合
            return {"success": False, "error": f"Path does not exist: {normalized_path}"}

        return {"success": True}
    except Exception as e:
        return {"success": False, "error": str(e)}

def main():
    while True:
        message = read_message()
        if message is None:
            break

        if "path" in message:
            result = open_path(message["path"])
            send_message(result)
        else:
            send_message({"success": False, "error": "No path provided"})

if __name__ == "__main__":
    main()
