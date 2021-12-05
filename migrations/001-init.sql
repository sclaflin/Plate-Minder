--------------------------------------------------------------------------------
-- Up
--------------------------------------------------------------------------------

CREATE TABLE Plate (
  Number   VARCHAR(32) NOT NULL,
  EpochTime INTEGER NOT NULL,
  ImageWidth INTEGER NOT NULL,
  ImageHeight INTEGER NOT NULL,
  ProcessingTime NUMBER NOT NULL,
  Confidence NUMERIC NOT NULL,
  TopLeftX INTEGER NOT NULL,
  TopLeftY INTEGER NOT NULL,
  TopRightX INTEGER NOT NULL,
  TopRightY INTEGER NOT NULL,
  BottomRightX INTEGER NOT NULL,
  BottomRightY INTEGER NOT NULL,
  BottomLeftX INTEGER NOT NULL,
  BottomLeftY INTEGER NOT NULL
);

CREATE INDEX Plate_IX_Number ON Plate(Number);

--------------------------------------------------------------------------------
-- Down
--------------------------------------------------------------------------------

DROP INDEX Plate_IX_Number;
DROP TABLE Plate;
