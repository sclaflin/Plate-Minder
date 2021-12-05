# Plate Minder #

Monitor an RTSP stream for license plates and record them.

This project is a proof of concept. While a web UI will be forthcoming shortly, the only interaction to be had is reading the database that the application writes found plates to.

Short term goals:

 * Provide better support for hardware accelleration
 * Provide MQTT support for recording found plates
 * Provide web UI for reporting

## Installation ##

A docker image is available via:
```bash
docker pull sclaflin/plate-minder:latest
```

Docker Compose:

```yaml
version: "3.9"
services:
  plate-minder:
    container_name: plate-minder
    restart: unless-stopped
    image: sclaflin/plate-minder:latest
    volumes:
      - ./data:/app/data
      - ./config.yaml:/app/config.yaml
  open-alpr-http-wrapper:
    container_name: open-alpr-http-wrapper
    restart: unless-stopped
    image: sclaflin/open-alpr-http-wrapper:latest

```

config.yaml:

```yaml
rtsp:
  # Path to your camera's RTSP stream
  url: 'rtsp://<your camera>'
  # How often an image should be captured
  captureInterval: 1
alpr:
  # Path to ALPRToHTTP server
  url: 'http://open-alpr-http-wrapper:3000/detect'
recorder:
  # Type of recorder. Currently sqlite is only supported.
  - type: 'sqlite'
```

## Usage ##

Open the database for reading. ;-)

Pre-compiled ffmpeg binary provided by: https://johnvansickle.com/ffmpeg/
