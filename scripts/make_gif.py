import sys
import os
from PIL import Image

def make_gif(frame_dir, output_gif, duration=250, loop=0):
    files = sorted([os.path.join(frame_dir, f) for f in os.listdir(frame_dir) if f.endswith('.png')])
    if not files:
        print(f"No frames in {frame_dir}")
        return
    images = []
    for f in files:
        im = Image.open(f)
        # Resize to reasonable dimensions for smooth gif and low file size
        im_resized = im.resize((960, 540), Image.Resampling.LANCZOS)
        images.append(im_resized.convert('RGB'))
    
    images[0].save(output_gif, save_all=True, append_images=images[1:], duration=duration, loop=loop, optimize=True)
    print(f"Saved GIF: {output_gif} ({len(images)} frames)")

if __name__ == '__main__':
    frame_dir = sys.argv[1]
    output_gif = sys.argv[2]
    duration = int(sys.argv[3]) if len(sys.argv) > 3 else 300
    make_gif(frame_dir, output_gif, duration)
