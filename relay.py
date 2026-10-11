import socket
import threading
import subprocess

def get_wsl_ip():
    try:
        out = subprocess.check_output(["wsl", "-d", "Ubuntu-24.04", "hostname", "-I"], text=True).strip().split()[0]
        return out
    except Exception:
        return "172.22.75.241"

def forward(src, dst):
    while True:
        try:
            data = src.recv(4096)
            if not data:
                break
            dst.sendall(data)
        except Exception:
            break

def handle_client(client_sock, wsl_ip):
    try:
        pg_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        pg_sock.connect((wsl_ip, 5432))
        t1 = threading.Thread(target=forward, args=(client_sock, pg_sock), daemon=True)
        t2 = threading.Thread(target=forward, args=(pg_sock, client_sock), daemon=True)
        t1.start()
        t2.start()
        t1.join()
        t2.join()
    except Exception as e:
        pass
    finally:
        client_sock.close()

def main():
    wsl_ip = get_wsl_ip()
    print(f"WSL IP: {wsl_ip}", flush=True)
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind(('127.0.0.1', 5433))
    server.listen(50)
    print("RELAY_5433_READY", flush=True)
    while True:
        client, _ = server.accept()
        threading.Thread(target=handle_client, args=(client, wsl_ip), daemon=True).start()

if __name__ == '__main__':
    main()
