# Plate Minder #

[GitHub](https://github.com/sclaflin/Plate-Minder) | [Docker Hub](https://hub.docker.com/r/sclaflin/plate-minder)

Monitor an MJPEG stream for license plates and record them.

Currently RTSP & video files can be converted to an MJPEG stream. See the `config.yaml` example below.

This project is a proof of concept.

Short term goals:

 * Provide better support for hardware accelleration
 * ~~Provide MQTT support for recording found plates~~


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
capture:
  # How often an image should be captured. 
  # Increments are in seconds. Fractional values (i.e. "0.5") can be used for sub-second capturing.
  captureInterval: 1

  # Have an RTSP stream? Uncomment and enter the URL for your RTSP camera.
  # type: rtsp
  # url: 'rtsp://<your camera>'

  # Have a video file you want to process? Uncomment and enter the path of your video
  # type: file
  # file: ./<path to your video file>

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

Assuming Plate-Minder is sending data to your MQTT broker, adding the following to your `configuration.yaml` will add plate sensor and plate camera to Home Assistant.

```yaml
sensor:
  - platform: mqtt
    name: Plate Number
    icon: mdi:car
    state_topic: plate-minder/plate

camera:
  - platform: mqtt
    name: Plate Image
    topic: plate-minder/image
```
Picture entity card & entities card examples:
![GitHub Logo](/images/home_assistant.png)