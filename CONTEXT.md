# Web Harmonium: glossary

- **Instrument**: anything that turns Note events into sound. The Harmonium is the first Instrument. Others come later as Packs.
- **Note event**: a request to start or stop one note, carrying a note number and a Velocity.
- **Input source**: where Note events come from: the computer keyboard, a pointer on an on-screen key, or a MIDI device.
- **Velocity**: how strongly a note is played, from 0 to 1. Only pointer pressure (pen or touch) and MIDI devices measure it. The computer keyboard does not.
- **Bellows pressure**: the air available to the reeds, from 0 to 1. It is the main loudness control of the Harmonium. The player sets it.
- **Bellows decay**: an optional mode where held notes use up Bellows pressure over time, and the pressure refills once no keys are held.
- **Air**: how long a full bellows lasts when Bellows decay is on.
- **Reed stop**: a bank of reeds that can be switched on or off. The Bass stop sounds an octave below, the Main stop at pitch, and the High stop an octave above.
- **Reed attack**: how much of the reed's natural swell plays at the start of a note. Soft keeps the full swell. Quick skips most of it, so the note sounds sooner after the key is pressed.
- **Drone**: a note that sounds continuously without being held. Here it is Sa, with Pa optional.
- **Sa (Tonic)**: the reference note of the Scale. It is movable.
- **Sargam label**: the name of a note relative to Sa: Sa re Re ga Ga Ma ma Pa dha Dha ni Ni. Lowercase marks a komal note; ma is tivra.
- **Scale**: the set of notes, counted relative to Sa, that belong to a thaat or western scale.
- **Scale lock**: notes outside the Scale stay silent.
- **Transpose**: shifts the sound by semitones while keys, labels and Sa stay in place, like a scale-changer harmonium.
- **Master tuning**: the reference frequency of A4 in Hz.
- **Key window**: the run of notes the computer keyboard can reach at a time. Octave shift moves it.
- **Pack**: a loadable Instrument sound set, described by a **Pack manifest** that lists samples, their note ranges and their loop points.
