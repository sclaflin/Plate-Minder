# Plate Minder #

[GitHub](https://github.com/sclaflin/Plate-Minder) | [Docker Hub](https://hub.docker.com/r/sclaflin/plate-minder)

Monitor an MJPEG stream for license plates and record them.

Currently RTSP & video files can be converted to an MJPEG stream. See the `config.yaml` example below.

This project is a proof of concept.

Short term goals:

 * Provide better support for hardware accelleration
 * ~~Provide MQTT support for recording found plates~~
 * ~~Provide original image and not just the ROI~~
 * ~~Draw an ROI box in original image~~
 * ~~Multiple camera support~~
 * ~~Customizable base topic~~
 * ~~Use home assistant autodiscovery~~
 * Storage of images where plates have been detected.
	* Customizable & tokenized file names.
 * Web UI for configuration


 ## Components ##

 Plate minder consists of extensible and loosely coupled components.

```mermaid
flowchart LR

MJPEGReadable --> MJPEGToJPEG
MJPEGToJPEG --> ImageFilter
ImageFilter --> OpenALPRDetect
OpenALPRDetect --> PlateRecorder
```

`MJPEGReadable` converts a video source to MJPEG. 
- `RTSPMJPEGReadable` converts an RTSP stream into an MJPEG stream.
- `FileMJPEGReadable` converts a video file from disk into an MJPEG stream.

`MJPEGToJPEG` extracts JPEG images from an MJPEG stream.

`ImageFilter` performs pre-processing of images.
- `MaskImageFilter` masks out polygon shapes from an image.
- `MotionImageFilter` crops an image to the largest area of detected motion.

`OpenALPRDetect` sends JPEG images to an open-alpr-http-wrapper service and captures detected license plate information.

`PlateRecorder` stores/transmits captured license plate information.
- `SQLitePlateRecorder` stores captured license plate data in a SQLite database.
- `MQTTPlateRecorder` sends captured license plate date to an MQTT broker.

## Installation ##

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
sources:
  # Have an RTSP stream? Uncomment and enter the URL for your RTSP camera.
  - type: rtsp
    name: Northbound
    url: 'rtsp://rtsp://<your camera>'
    # How often an image should be captured. 
    # Increments are in seconds. Fractional values (i.e. "0.5") can be used for sub-second capturing.
    captureInterval: 1
  # Have a video file you want to process? Uncomment and enter the path of your video
  # - type: file
  #   name: Southbound
  #   file: ./<path to your video file>
  #   captureInterval: 1

# Globall applied filters
# Filter jpeg frames. Currently 'motion' and 'mask' filters are available.
# Filters are processed in the order they are defined
filters:
  # Masks out a portion of the frame. Note that any pixels within the mask
  # cannot be used for detection.
  - type: mask
    # Optional. Outputs an image to the './data' path
    # debug: true
    shapes:
      # Shapes are a series of x/y coordinates
      - 1267,0,1920,0,1920,100,1267,100 # Timestamp, top right
  # Crops the frame down to the largest area of motion detection
  - type: motion
    # Optional. Outputs an image to the './data' path
    # debug: true
  
openALPR:
  # Path to ALPRToHTTP server
  url: http://open-alpr-http-wrapper:3000/detect

# Record detected license plate information
recorders:
  # Output to a SQLite database
  - type: sqlite
  # Output to an MQTT host
  # - type: mqtt
  #   url: <URL to your MQTT instance>
  #   # Optional - Default base topic is 'plate-minder'
  #   baseTopic: plate-minder
  #   # Connection options can be found here: https://github.com/mqttjs/MQTT.js#client
  #   mqttOptions:
  #     username: username
  #     password: mypassword
```

## Usage ##

### SQLite ###

Enabling the sqlite recorder will save the detected plate information into a SQLite database file (`./data/database.db`).
Reporting & analytics queries can be run against it.


### MQTT ###

Enabling the MQTT recorder will publish detected plate information to the `plate-minder` base topic. The following subtopics are available:

`plate-minder/detect` contains a JSON string containing the most recent detection info:

```json
{
  "epoch_time": 1640031280937,
  "results": [
    {
      "plate": "ABC123",
      "confidence": 89.232658,
      "matches_template": 0,
      "plate_index": 0,
      "region": "",
      "region_confidence": 0,
      "processing_time_ms": 18.699596,
      "requested_topn": 10,
      "coordinates": [
        {
          "x": 510,
          "y": 516
        },
        {
          "x": 698,
          "y": 516
        },
        {
          "x": 698,
          "y": 611
        },
        {
          "x": 508,
          "y": 611
        }
      ],
      "candidates": [
        {
          "plate": "ABC123",
          "confidence": 89.232658,
          "matches_template": 0
        }
      ]
    }
  ]
}
```
`plate-minder/plate` contains the most recently detected plate number.

`plate-minder/image` contains a JPEG image of the most recently detected plate number.

### Home Assistant ###

Assuming Plate-Minder is sending data to your MQTT broker, the following entites should be auto-discovered per video source:

* `sensor.<Source Name>_plate`
* `camera.<Source Name>_image`
* `camera.<Source Name>_roi`

Picture entity card & entities card examples:

![Home Assistant Example](/images/home_assistant.png)

## Thanks ##

This project has been a pleasure to develop due largely to standing on the shoulders of giants.

* [Docker](https://www.docker.com/)
* [FFMPEG](https://ffmpeg.org/)
* [ffmpeg-static](https://github.com/eugeneware/ffmpeg-static)
* [Git](https://git-scm.com/)
* [MQTT.js](https://github.com/mqttjs)
* [node.js](https://nodejs.org)
* [node-sqlite](https://github.com/kriasoft/node-sqlite)
* [node-sqlite3](https://github.com/mapbox/node-sqlite3/)
* [npm](https://www.npmjs.com/)
* [OpenALPR](https://github.com/openalpr/openalpr)
* [OpenCV](https://opencv.org/)
* [Sharp](https://github.com/lovell/sharp)
* [VSCode](https://code.visualstudio.com/)
