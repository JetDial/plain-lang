// Plain - starter programs.
// `plain make <kind> <name>` writes one of these. Each one runs as it is,
// and is written to be read and changed straight away.

export const TEMPLATES = {
  game: {
    about: 'a finished 2D game you can play and change',
    command: 'play',
    source: (name) => `# ${name} - a 2D game in Plain.
# Play it with:  plain play this-file.plain
# Move with the left and right arrow keys. Press space to jump.

start a game called "${name}" sized 720 by 480
set the background to "#12141f"
set gravity to 0.6

make hero be a box at 120 , 300 sized 30 by 40 colored "#ffd166"
make ground be a box at 360 , 460 sized 720 by 40 colored "#2a2f45"
make coin be a circle at 520 , 380 sized 20 colored "#7ee787"

make score be 0
make on_ground be no

every frame
    if key "left" is held
        move hero left by 6
    end
    if key "right" is held
        move hero right by 6
    end

    # Land on the ground instead of falling through it.
    if y of hero is above 420
        set the y of hero to 420
        set the dy of hero to 0
        set on_ground to yes
    end

    keep hero on the screen
    draw "score {score}" at 20 , 18
end

when key "space" is pressed
    if on_ground
        set the dy of hero to -12
        set on_ground to no
        play a beep at 660
    end
end

when hero touches coin
    add 1 to score
    move coin to random 60 to 660 , random 200 to 400
    play a beep at 880
end
`
  },

  world: {
    about: 'a 3D world you can walk around',
    command: 'play',
    source: (name) => `# ${name} - a 3D world in Plain.
# Play it with:  plain play this-file.plain
# Turn with left and right, walk with up and down.

start a world called "${name}" sized 900 by 600
set the sky to "#0d1b2a"
set world gravity to 0.02

make ground be a floor at 0 , 0 , 0 sized 60 by 60 colored "#2f7d4f"
make hero be a cube at 0 , 1 , 0 sized 1.6 colored "#ffd166"
make tower be a post at 8 , 3 , -6 sized 2 by 6 colored "#9aa0aa"
make prize be a ball at -6 , 1 , -8 sized 1.4 colored "#ef476f"

follow hero with the camera
set the camera distance to 9
set the camera height to 4

make score be 0

every frame
    if key "left" is held
        turn hero left by 3
    end
    if key "right" is held
        turn hero right by 3
    end
    if key "up" is held
        move hero forward by 0.18
    end
    if key "down" is held
        move hero back by 0.14
    end
    draw "collected {score}" at 20 , 18
end

when key "space" is pressed
    if hero is resting
        push hero up by 0.35
    end
end

when hero touches prize
    add 1 to score
    move prize to random -20 to 20 , 1 , random -20 to 20
    play a beep at 880
end
`
  },

  site: {
    about: 'a website with pages, cards and a button',
    command: 'edit',
    source: (name) => `# ${name} - a website in Plain.
# See it with:   plain play this-file.plain
# Design it with: plain edit this-file.plain
# Publish it with: plain build this-file.plain --out site

make a website called "${name}"
set the theme to "light"

add a title "${name}"
add text "A site written in sentences."

add a card called "What is here"
    add text "Change any of this by typing, or by dragging in the designer."
    add a list of "It is one file", "It builds to plain HTML", "It reads out loud"
end

add a button "Say hello"
    show a message "Hello!"
end

add a space
add a footer "Made with Plain."

make a page called "About" at "/about"

add a title "About"
add text "This is the second page. Add as many as you like."
add a footer "Made with Plain."
`
  },

  video: {
    about: 'a video timeline with titles and clips',
    command: 'edit',
    source: (name) => `# ${name} - a video in Plain.
# Watch it with: plain play this-file.plain
# Edit it with:  plain edit this-file.plain
#
# Put your own .mp4 and .jpg files next to this one and use their names.

make a video called "${name}" sized 1280 by 720
set the frame rate to 30

add a title "${name}" for 3 seconds
fade the last clip in over 1 seconds

add a background "#1b2a41" for 2 seconds
put the words "Chapter one" on the last clip

add a title "Drop a clip in here" for 3 seconds
fade the last clip out over 1 seconds

# add a clip "holiday.mp4" from 4 to 12 seconds
# add a picture "beach.jpg" for 4 seconds
# add music "song.mp3"
`
  },

  program: {
    about: 'a plain terminal program',
    command: 'run',
    source: (name) => `# ${name} - a Plain program.
# Run it with:  plain run this-file.plain

make name be "world"
show "Hello, {name}!"

make score be 0
repeat 3 times
    add 10 to score
end
show "Score: {score}"

to describe with number
    if number is above 20
        give back "a good score"
    end
    give back "a start"
end

show describe with score
`
  }
};

export function templateNames() {
  return Object.keys(TEMPLATES);
}
