import type { DziImage } from '@alleninstitute/vis-dzi';

// DZI files will come with XML or JSON to give you important information such as the width, height, and format.
// Below is a function for parsing an xml with that data, althought sometimes it comes in JSON format.
// At the end of the file you can see two examples of the metadata format you might see, one as XML and another as JSON
/**
 * This function helps decode xml metadata for a dzi file.
 * @param s xml string
 * @param url url for dzi file
 * @returns formatted dzi image data
 */
function decodeDziXml(s: string, url: string): DziImage | undefined {
    const parser = new DOMParser();
    const doc = parser.parseFromString(s, 'text/xml');
    // catch any errors if the xml is malformed
    const err = doc.querySelector('Error');
    if (err) return undefined;

    if (doc) {
        const img = doc.getElementsByTagName('Image')[0];
        const size = doc.getElementsByTagName('Size')[0];
        // format: as jpg/png
        // overlap: how much overlap there is between images so that we can compensate the rendering
        // tile size: how big in pixels each tile is
        const [format, overlap, tileSize] = [
            img.getAttribute('Format'),
            img.getAttribute('Overlap'),
            img.getAttribute('TileSize'),
        ];
        if (size && format && overlap && tileSize) {
            // width and height of the image, so we can properly size the view
            const width = size.getAttribute('Width');
            const height = size.getAttribute('Height');

            // the url ends with .dzi to denote that we're reaching for a dzi file
            // in order to get the images from that url we need to remove the .dzi
            // and replace it with _files/ so that the image viewer knows where to look
            const dataLoc = url.split('.dzi')[0];
            if (width && height && dataLoc) {
                return {
                    imagesUrl: `${dataLoc}_files/`,
                    format: format as 'jpeg' | 'png' | 'jpg' | 'JPG' | 'PNG',
                    overlap: Number.parseInt(overlap, 10),
                    tileSize: Number.parseInt(tileSize, 10),
                    size: {
                        width: Number.parseInt(width, 10),
                        height: Number.parseInt(height, 10),
                    },
                };
            }
        }
    }

    return undefined;
}

/* Example XML
<?xml version="1.0" encoding="UTF-8"?>
<Image xmlns="http://schemas.microsoft.com/deepzoom/2008"
       Format="jpg" 
       Overlap="2" 
       TileSize="256" >
    <Size Height="9221" 
          Width="7026"/>
</Image>
*/

/* Example JSON
{
    "Image": {
        "xmlns":    "http://schemas.microsoft.com/deepzoom/2008",
        "Format":   "jpg", 
        "Overlap":  "2", 
        "TileSize": "256",
        "Size": {
            "Height": "9221",
            "Width":  "7026"
        }
    }
}
*/
