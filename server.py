from flask import Flask, send_from_directory

app = Flask(__name__, static_folder='.', static_url_path='')

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path != "" and "." in path:
        return send_from_directory('.', path)
    return send_from_directory('.', 'index.html')

app.run(port=8888)
