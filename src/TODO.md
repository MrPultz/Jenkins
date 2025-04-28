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
- [ ] Fix size issues for scene. Plus make sure it removes the old object.
- [ ] Make bounding box for the first object (Generated Object) -> Can't do this until we have made prompt engineering
- [ ] Write the prompt engineering
- [X] Make sure the pivot is always touching the surface of the other object
- [ ] Be able to write to the chat what to do with that object (convert the result to xyz that can be changed in the code and use with live update viewer)
- [X] Testing of the bounding box so the object can't go through the box.
- [X] Test if we can send the whole canvas to Claude (why did we want this?)
- [ ] Fix bounding box does not show right size atm.
- [ ] Fix so you can't click when are using the controls.
- [X] Add so that, when you switch to the interaction mode, link to right page
- 



### Notes:
found an issue when trying to generate a remote control. something with geometry.
TO get the bounding box, we have the buttons x,y,z and size, and then we should see where the different objects are, and make a bounding box on everything else.

