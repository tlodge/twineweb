window.storyFormat({
    "name":"Mundane",
    "version":"1.0.0",
    "description":"The default proofing format for Twine 2. Icon designed by <a href=\"http://www.thenounproject.com/Simon Child\">Simon Child</a> from the <a href=\"http://www.thenounproject.com\">Noun Project</a>",
    "author":"<a href=\"http://www.tomlodge.info\">Tom Lodge</a>",
    "image":"icon.svg",
    "url":"http://twinery.org/",
    "license":"ZLib/Libpng",
    "proofing":true,
    "source":"<!DOCTYPE html>\n<html>\n<head>\n<title>{{STORY_NAME}}\n</title>\n<meta charset=\"utf-8\">\n</head>\n\n<body>\n\n<h1>{{STORY_NAME}}\n</h1>\n{{STORY_DATA}}\n\n\n<script src=\"./story-formats/mundane/mundane.js\">\n</script></body>\n</html>\n"
});