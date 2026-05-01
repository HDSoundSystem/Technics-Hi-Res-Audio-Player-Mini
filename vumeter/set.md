// Dans initAudio :
analyserL.fftSize = 64;  // au lieu de 256
analyserR.fftSize = 64;

// Dans drawVU — decay rapide :
lastVolL = volL < lastVolL ? lastVolL - 5 : volL;
lastVolR = volR < lastVolR ? lastVolR - 5 : volR;

// Peak qui tient moins longtemps :
if (lastVolL >= peakL) { peakL = lastVolL; peakTimerL = 25; }