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
- [ ] Change 3D viewer so easier to see what it made (maybe material or lighting)


### TODO for moving another object
- [ ] Make other Object (horn just be there)
- [ ] Create a pivot for the uploaded object
- [ ] Be able to write to the chat what to do with that object (convert the result to xyz that can be changed in the code and use with live update viewer)
- [ ] Make bounding box for the first object
- [ ] Make sure the pivot is always touching the surface of the other object
- [ ] Testing of the bounding box so the object can't go through the box.
- [ ] Test if we can send the whole canvas to Claude
- [ ] See if we can click on a face and move the object to that face


### Notes:
found an issue when trying to generate a remote control. something with geometry.
