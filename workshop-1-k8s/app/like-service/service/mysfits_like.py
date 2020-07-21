from __future__ import print_function

import os
import sys
import requests
from urllib.parse import urlparse
from flask import Flask, jsonify, json, Response, request
from flask_cors import CORS
import logging

app = Flask(__name__)
CORS(app)

logging.basicConfig(level=logging.DEBUG)

print(f"Here we go v10", file=sys.stderr)

# The service basepath has a short response just to ensure that healthchecks
# sent to the service root will receive a healthy response.
@app.route("/")
def health_check_response():
    return jsonify({"message" : "Nothing here, used for health check."})
# indicate that the provided mysfit should be marked as liked.

def process_like_request():
    print('Like processed.', file=sys.stderr)

def fulfill_like(mysfit_id):
    print(f"Fulfill The request {mysfit_id}", file=sys.stderr)
    url_s = f"http://{os.environ['MONOLITH_URL']}/mysfits/{mysfit_id}/fulfill-like"
    print(url_s)
    url = urlparse(url_s)
    return requests.post(url=url.geturl())

@app.route("/mysfits/<mysfit_id>/like", methods=['POST'])
def like_mysfit(mysfit_id):
    process_like_request()
    print('Like being processed.', file=sys.stderr)
    print(f"Here we go like", file=sys.stderr)
    print(f"The request {mysfit_id}", file=sys.stderr)
    app.logger.info(f"The request {mysfit_id}")
    
    service_response = fulfill_like(mysfit_id)

    flask_response = Response(service_response)
    flask_response.headers["Content-Type"] = "application/json"

    return flask_response

# Run the service on the local server it has been deployed to,
# listening on port 8080.
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=80)
