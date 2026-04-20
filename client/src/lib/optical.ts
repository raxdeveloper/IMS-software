/** Re-export optical utilities from `utils/optical` for legacy imports. */
export {
  OPTICAL_CONSTANTS,
  encodeOptical,
  decodeOptical,
  decodeRxDisplay,
  decodeADD,
  decodePD,
  formatNPR,
  transpose,
  transpositionLabel,
  encodePdMm,
  decodePdMm,
  parseOpticalToInt,
  formatPowerDisplay,
  formatDiopter,
  formatAddDiopter,
  formatAxisDisplay,
} from "../utils/optical";
