from pathlib import Path

from app.config import get_settings
from app.schemas import DetectionBox, FrameDetectionResponse


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def _box_from_pixels(
    x: float,
    y: float,
    width: float,
    height: float,
    frame_width: float,
    frame_height: float,
    confidence: float,
    label: str,
) -> DetectionBox:
    return DetectionBox(
        x=_clamp01(x / max(1.0, frame_width)),
        y=_clamp01(y / max(1.0, frame_height)),
        width=_clamp01(width / max(1.0, frame_width)),
        height=_clamp01(height / max(1.0, frame_height)),
        confidence=_clamp01(confidence),
        label=label,  # type: ignore[arg-type]
    )


class FrameDetector:
    def detect(self, frame_path: str, detect_faces: bool = True, detect_persons: bool = True) -> FrameDetectionResponse:
        settings = get_settings()
        faces: list[DetectionBox] = []
        persons: list[DetectionBox] = []
        providers: list[str] = []

        if detect_faces:
            detected_faces, face_provider = self._detect_faces(frame_path)
            faces = detected_faces
            providers.append(face_provider)

        if detect_persons:
            detected_persons, person_provider = self._detect_persons(frame_path)
            persons = detected_persons
            providers.append(person_provider)

        provider = "+".join([p for p in providers if p]) or "none"
        return FrameDetectionResponse(
            faces=faces,
            persons=persons,
            provider=provider,
            modelVersions={
                "face": settings.face_model_name if detect_faces else None,
                "person": settings.person_model_name if detect_persons else None,
            },
        )

    def _read_image(self, frame_path: str):
        try:
            import cv2

            if not Path(frame_path).exists():
                return None, None
            image = cv2.imread(frame_path)
            if image is None:
                return None, None
            return image, cv2
        except Exception:
            return None, None

    def _detect_faces(self, frame_path: str) -> tuple[list[DetectionBox], str]:
        image, cv2 = self._read_image(frame_path)
        if image is None or cv2 is None:
            return [], "unavailable"

        settings = get_settings()
        height, width = image.shape[:2]

        mediapipe_faces = self._detect_faces_mediapipe(image, width, height)
        if mediapipe_faces:
            return mediapipe_faces, "mediapipe"

        try:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            cascade_path = getattr(cv2.data, "haarcascades", "") + "haarcascade_frontalface_default.xml"
            cascade = cv2.CascadeClassifier(cascade_path)
            detections = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(32, 32))
            faces = [
                _box_from_pixels(x, y, w, h, width, height, max(settings.face_confidence_threshold, 0.55), "face")
                for (x, y, w, h) in detections
            ]
            return faces, "opencv-haar"
        except Exception:
            return [], "opencv-haar"

    def _detect_faces_mediapipe(self, image, width: int, height: int) -> list[DetectionBox]:
        settings = get_settings()
        try:
            import cv2
            import mediapipe as mp

            rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            with mp.solutions.face_detection.FaceDetection(
                model_selection=1,
                min_detection_confidence=settings.face_confidence_threshold,
            ) as detector:
                result = detector.process(rgb)
            boxes: list[DetectionBox] = []
            for detection in result.detections or []:
                score = float(detection.score[0]) if detection.score else settings.face_confidence_threshold
                relative = detection.location_data.relative_bounding_box
                boxes.append(
                    DetectionBox(
                        x=_clamp01(float(relative.xmin)),
                        y=_clamp01(float(relative.ymin)),
                        width=_clamp01(float(relative.width)),
                        height=_clamp01(float(relative.height)),
                        confidence=_clamp01(score),
                        label="face",
                    )
                )
            return boxes
        except Exception:
            return []

    def _detect_persons(self, frame_path: str) -> tuple[list[DetectionBox], str]:
        image, cv2 = self._read_image(frame_path)
        if image is None or cv2 is None:
            return [], "unavailable"

        yolo_boxes = self._detect_persons_yolo(image)
        if yolo_boxes:
            return yolo_boxes, "yolo-onnx"

        settings = get_settings()
        try:
            height, width = image.shape[:2]
            hog = cv2.HOGDescriptor()
            hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
            detections, weights = hog.detectMultiScale(image, winStride=(8, 8), padding=(16, 16), scale=1.05)
            persons: list[DetectionBox] = []
            for index, (x, y, w, h) in enumerate(detections):
                weight = float(weights[index]) if index < len(weights) else settings.person_confidence_threshold
                confidence = max(settings.person_confidence_threshold, min(0.88, 0.45 + weight / 4))
                persons.append(_box_from_pixels(x, y, w, h, width, height, confidence, "person"))
            return persons, "opencv-hog"
        except Exception:
            return [], "opencv-hog"

    def _detect_persons_yolo(self, image) -> list[DetectionBox]:
        settings = get_settings()
        if not settings.yolo_model_path or not Path(settings.yolo_model_path).exists():
            return []

        try:
            import cv2
            import numpy as np
            import onnxruntime as ort

            frame_height, frame_width = image.shape[:2]
            size = settings.yolo_input_size
            rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            resized = cv2.resize(rgb, (size, size))
            tensor = resized.astype(np.float32) / 255.0
            tensor = np.transpose(tensor, (2, 0, 1))[None, ...]

            session = ort.InferenceSession(settings.yolo_model_path, providers=["CPUExecutionProvider"])
            input_name = session.get_inputs()[0].name
            outputs = session.run(None, {input_name: tensor})
            predictions = outputs[0]
            return self._parse_yolo_predictions(predictions, frame_width, frame_height)
        except Exception:
            return []

    def _parse_yolo_predictions(self, predictions, frame_width: int, frame_height: int) -> list[DetectionBox]:
        settings = get_settings()
        try:
            import numpy as np

            array = np.squeeze(predictions)
            if array.ndim != 2:
                return []
            if array.shape[0] < array.shape[1] and array.shape[0] <= 85:
                array = array.T

            boxes: list[DetectionBox] = []
            for row in array:
                if len(row) < 6:
                    continue
                class_scores = row[5:]
                class_id = int(np.argmax(class_scores)) if len(class_scores) else int(row[5])
                if class_id != 0:
                    continue
                objectness = float(row[4])
                class_conf = float(class_scores[class_id]) if len(class_scores) else 1.0
                confidence = objectness * class_conf
                if confidence < settings.person_confidence_threshold:
                    continue

                cx, cy, bw, bh = [float(v) for v in row[:4]]
                if cx > 1 or cy > 1 or bw > 1 or bh > 1:
                    cx /= settings.yolo_input_size
                    cy /= settings.yolo_input_size
                    bw /= settings.yolo_input_size
                    bh /= settings.yolo_input_size
                x = max(0.0, cx - bw / 2)
                y = max(0.0, cy - bh / 2)
                boxes.append(
                    DetectionBox(
                        x=_clamp01(x),
                        y=_clamp01(y),
                        width=_clamp01(bw),
                        height=_clamp01(bh),
                        confidence=_clamp01(confidence),
                        label="person",
                    )
                )
            return boxes
        except Exception:
            return []
