import os
from flask import jsonify

@app.route('/images/<filename>', methods=['DELETE'])
def delete_image(filename):
    try:
        # 删除图片文件
        image_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        if os.path.exists(image_path):
            os.remove(image_path)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500 