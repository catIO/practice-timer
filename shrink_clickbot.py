from PIL import Image, ImageDraw
import sys

def add_corners(im, rad):
    circle = Image.new('L', (rad * 2, rad * 2), 0)
    draw = ImageDraw.Draw(circle)
    draw.ellipse((0, 0, rad * 2 - 1, rad * 2 - 1), fill=255)
    
    alpha = Image.new('L', im.size, 255)
    w, h = im.size
    
    alpha.paste(circle.crop((0, 0, rad, rad)), (0, 0))
    alpha.paste(circle.crop((0, rad, rad, rad * 2)), (0, h - rad))
    alpha.paste(circle.crop((rad, 0, rad * 2, rad)), (w - rad, 0))
    alpha.paste(circle.crop((rad, rad, rad * 2, rad * 2)), (w - rad, h - rad))
    
    im.putalpha(alpha)
    return im

def shrink_icon(path, size, scale_factor=0.75):
    try:
        im = Image.open(path).convert('RGBA')
        bg_color = (0, 0, 0, 255) # We know it's black
        
        # 1. Fill transparent corners of the original image with its background color
        filled = Image.new('RGBA', im.size, bg_color)
        filled.paste(im, (0, 0), im) # Use the image itself as a mask if needed, but simple paste works
        # Actually better to just composite
        filled = Image.alpha_composite(Image.new('RGBA', im.size, bg_color), im)
        
        # 2. Resize the filled image
        new_w = int(im.width * scale_factor)
        new_h = int(im.height * scale_factor)
        shrunk = filled.resize((new_w, new_h), Image.Resampling.LANCZOS)
        
        # 3. Create a new full-size canvas with the background color
        final_canvas = Image.new('RGBA', im.size, bg_color)
        
        # 4. Paste the shrunk image in the center
        offset_x = (im.width - new_w) // 2
        offset_y = (im.height - new_h) // 2
        final_canvas.paste(shrunk, (offset_x, offset_y))
        
        # 5. Apply new squircle
        radius = int(im.width * 0.225)
        rounded = add_corners(final_canvas, radius)
        
        rounded.save(path, "PNG")
        print(f"Successfully processed {path}")
    except Exception as e:
        print(f"Error processing {path}: {e}")

if __name__ == "__main__":
    shrink_icon('../clickbot/public/icons/icon-512x512.png', 512)
    shrink_icon('../clickbot/public/icons/icon-192x192.png', 192)
