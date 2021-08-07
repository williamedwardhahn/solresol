https://github.com/kushalbhabra/pyMidi/blob/master/src/test.py
https://www.edureka.co/community/19373/how-can-i-read-piano-notes-on-python    
https://github.com/xamox/pygame/blob/master/examples/midi.py    


##############################################



beep = tone.create('A3', 0.5)

def on_mouse_down():
    beep.play()


############################################################

import pgzrun

WIDTH = 500
HEIGHT = 100
TITLE = "Fading Green!"

c = 0


def draw():
    screen.fill((0, c, 0))


def update(dt):
    global c, HEIGHT
    c = (c + 1) % 256
    if c == 255:
        HEIGHT += 10


def on_mouse_down(button, pos):
    print("Mouse button", button, "clicked at", pos)
    
pgzrun.go()


#############################################################################3


import pgzrun


WIDTH = 800
HEIGHT = 600

def draw():
    screen.clear()
    screen.draw.circle((400, 300), 30, 'white')

def on_mouse_down(pos, button):
    print("Mouse button", button, "clicked at", pos)

pgzrun.go()



####################################################################33


import pygame

pygame.init()

display = pygame.display.set_mode((640,480),0,32)

while True:

    for event in pygame.event.get():

        x,y = pygame.mouse.get_pos()
        
    print(x,y)

            
            

