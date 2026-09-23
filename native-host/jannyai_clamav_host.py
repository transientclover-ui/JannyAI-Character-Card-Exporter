#!/usr/bin/env python3
import base64
import binascii
import json
import shutil
import struct
import subprocess
import sys

MAX_BYTES = 16 * 1024 * 1024
MAX_MESSAGE_BYTES = 24 * 1024 * 1024
SCAN_TIMEOUT_SECONDS = 30


def write_message(message):
    encoded = json.dumps(message, separators=(',', ':')).encode('utf-8')
    sys.stdout.buffer.write(struct.pack('<I', len(encoded)))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()


def read_exact(size):
    data = bytearray()
    while len(data) < size:
        chunk = sys.stdin.buffer.read(size - len(data))
        if not chunk:
            return None
        data.extend(chunk)
    return bytes(data)


def read_message():
    length = read_exact(4)
    if length is None:
        return None
    size = struct.unpack('<I', length)[0]
    if size == 0 or size > MAX_MESSAGE_BYTES:
        raise ValueError('Invalid Native Messaging request size.')
    payload = read_exact(size)
    if payload is None:
        raise ValueError('Truncated Native Messaging request.')
    decoded = json.loads(payload.decode('utf-8'))
    if not isinstance(decoded, dict):
        raise ValueError('Native Messaging request must be an object.')
    return decoded


def clamscan_path():
    return next((candidate for candidate in ('/usr/bin/clamscan', '/usr/local/bin/clamscan', shutil.which('clamscan')) if candidate), None)


def scan(request):
    if request.get('fileType') not in ('png', 'json'):
        return {'status': 'failed', 'message': 'Expected png or json file type.'}
    encoded = request.get('data')
    if not isinstance(encoded, str) or len(encoded) > ((MAX_BYTES + 2) // 3) * 4:
        return {'status': 'failed', 'message': 'Invalid or oversized scan data.'}
    try:
        content = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error):
        return {'status': 'failed', 'message': 'Invalid base64 scan data.'}
    if not content or len(content) > MAX_BYTES:
        return {'status': 'failed', 'message': 'Invalid or oversized scan data.'}
    scanner = clamscan_path()
    if not scanner:
        return {'status': 'failed', 'message': 'ClamAV clamscan is not installed.'}
    try:
        completed = subprocess.run(
            [scanner, '--no-summary', '-'], input=content, capture_output=True,
            timeout=SCAN_TIMEOUT_SECONDS, check=False
        )
    except subprocess.TimeoutExpired:
        return {'status': 'failed', 'message': 'clamscan timed out.'}
    except OSError as error:
        return {'status': 'failed', 'message': f'Could not run clamscan: {error}'}
    if completed.returncode == 0:
        return {'status': 'clean'}
    if completed.returncode == 1:
        output = (completed.stdout + completed.stderr).decode('utf-8', errors='replace')
        threat = next((line.split(':', 1)[1].rsplit(' FOUND', 1)[0].strip() for line in output.splitlines() if ': ' in line and line.endswith(' FOUND')), 'ClamAV detection')
        return {'status': 'threat', 'threat': threat}
    return {'status': 'failed', 'message': f'clamscan exited with code {completed.returncode}.'}


while True:
    try:
        message = read_message()
        if message is None:
            break
        write_message(scan(message))
    except Exception as error:
        write_message({'status': 'failed', 'message': f'Native host error: {error}'})
