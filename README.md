# Plate Minder #

Monitor an MJPEG stream for license plates and record them.

Currently RTSP & video files can be converted to an MJPEG stream. See the `config.yaml` example below.

This project is a proof of concept.

Short term goals:

 * Provide better support for hardware accelleration
 * Provide MQTT support for recording found plates

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
mjpeg:
  # How often an image should be captured
  captureInterval: 0.5

  # Have an RTSP stream? Uncomment and enter the URL for your RTSP camera.
  # type: 'rtsp'
  # url: 'rtsp://<your camera>'

  # Have a video file you want to process? Uncomment and enter the path of your video
  # type: 'file'
  # file: './<path to your video file>'
  
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
