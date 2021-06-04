// This file is part of www.nand2tetris.org
// and the book "The Elements of Computing Systems"
// by Nisan and Schocken, MIT Press.
// File name: projects/04/Fill.asm

// Runs an infinite loop that listens to the keyboard input.
// When a key is pressed (any key), the program blackens the screen,
// i.e. writes "black" in every pixel;
// the screen should remain fully black as long as the key is pressed.
// When no key is pressed, the program clears the screen, i.e. writes
// "white" in every pixel;
// the screen should remain fully clear as long as no key is pressed.

    @KBD      // IMPORTANT: the address of this line is 0
    A=M      // A = M[KBD]
    A;JEQ     // goto 0 if A = 0
(TOGGLE)
    @8191     // D = 256 * (512 / 16) - 1 = 8191
    D=A
(LOOP)
    @SCREEN   // M[SCREEN + D] = !M[SCREEN + D]
    A=D+A
    M=!M
    @LOOP     // D = D - 1; goto LOOP if D >= 0
    D=D-1;JGE
    @SCREEN   // goto 0 if MEMORY[SCREEN] = 0
    A=M
    A;JEQ
(PRESSED)
    @KBD
    D=M
    @PRESSED  // goto PRESSED if D > 0
    D;JGT
    @TOGGLE   // otherwise, goto TOGGLE
    0;JMP
