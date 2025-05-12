### TODO list
- [X] Main Page have small chat with drawing view on the right
- [X] Be able to upload the drawing and try to generate a layout based on that (need prompt)
- [X] When starting first chat change to 3D view with a generated layout
- [X] Keep iterating maybe asking to move button "something something" to the left
- [X] Remove footer.  
- [X] Add a button to go to the esthetic page with this stl
- [X] implement claude.ai API to be used (Only use when drawing is used)
- [X] Delete old lines (maybe arrows forwards and backwards)
- [X] Change to eraser.
- [X] Tests: Can make a keyboard/remote from drawing. Can do it from text. Can make both circle and square keys. 
- [X] Change 3D viewer so easier to see what it made (maybe material or lighting)
- [X] Fix that claude can write text all the way out, it only does that after the cutout commands.
- [X] Add a submit button

### TODO for moving another object
- [X] Make other Object (horn just be there)
- [X] Create a pivot for the uploaded object
- [X] See if we can click on a face and move the object to that face
- [X] Fix size issues for scene. Plus make sure it removes the old object.
- [X] Make bounding box for the first object (Generated Object) -> Can't do this until we have made prompt engineering
- [X] Get XYZ for the buttons to make the bounding box between.
- [X] Fix bounding box so it shows where you can't add it maybe?
- [X] Make Submit make expanded view so it ready to print (make new backend point)
- [X] Make sure the unicorn horn is always on a surface it can be seen on.
- [X] Add submit button to the viewer so that you can send it to the backend and get gcode and such.
- [X] Write the prompt engineering 
- [X] Write a better Prompt engineering maybe?
- [X] Make sure the pivot is always touching the surface of the other object
- [X] Be able to write to the chat what to do with that object (convert the result to xyz that can be changed in the code and use with live update viewer)
- [X] Testing of the bounding box so the object can't go through the box.
- [X] Test if we can send the whole canvas to Claude (why did we want this?)
- [X] Fix so you can't click when are using the controls.
- [X] Add so that, when you switch to the interaction mode, link to right page
- [X] Make chat always be scrolled to the bottom
- [X] Remove so it does not change between move rotate and scale when pressing keys in chat.
- [ ] We should probably write a better prompt to give it a much better context. And make it work better. Maybe add so that it does it based on the camera position?
- [ ] get the option to pick between 5 different objects to custimize with


### Submit button
- [X] Should get expanded view of model when converting to stl or gcode. OR should it? maybe just generate it when printing?

### Fixes for evaluation
- [ ] Remove clear canvas code, so that if you go back with redraw it's still there
- [X] Fix lang text written when drawing too.
- [ ] Button to get back to 3DView -> make a boolean to check if we have already drawn something or else don't show the button.
- [ ] Make unicorn horn remember position if you go back and forth maybe?
- [ ] padding at bottom to not compulate with apple.
- [ ] Switch orbit on and off -> button.
- [ ] remove ability to choose model -> default claude
- [X] Use long text rename to give detailed information
- [X] Change audio icon to have audio wave.
- [X] Be able to stop the audio by pressing again.
- [ ] Be able to stop response from AI. -> Later
- [X] Make load dots and circle loading same color.
- [X] Make submit button disabled when nothing is written or drawn. (Submit written and submit drawing)
- [ ] Make unicorn horn always on a surface it can be seen on.
- [ ] Fix speak function has something to do with the hosting of ws://
- [X] Bool options to generate 3 objs
- [ ] add multiple horns

### If got time
- [ ] Make toggle button to move chat in and out.

### Maintainance
- [X] Host it on a server
- [X] Redraw button
- [X] Button to change how much text it shows.
- [X] Cusztimizse model button name.
- [X] A button on custimze mode to get back to redesign.
- [ ] Make Submit make expanded view so it ready to print (make new backend point)


### For Between the rapport and exam -> All this new branch.
- [ ] Make a consultant prompt for the chat. That then knows based on the message which prompt to use.
- [ ] Implement so that it can then know if it should contact Meshy.ai to generate a model to get to add where ever you want.
- [ ] Setup so we can try and print it over network - skip for now
- [ ] Maybe add so it possible to have multiple object to move around and place, maybe add a list view and possible to press them like blender.


### Notes:
found an issue when trying to generate a remote control. something with geometry.
TO get the bounding box, we have the buttons x,y,z and size, and then we should see where the different objects are, and make a bounding box on everything else.

