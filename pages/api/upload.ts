import { api } from 'libs/server/connect';
import { useAuth } from 'libs/server/middlewares/auth';
import { useStore } from 'libs/server/middlewares/store';

export default api()
    .use(useAuth)
    .use(useStore)
    .post(async (req, res) => {
        // 图片上传功能已被移除，改为使用PostgreSQL存储
        res.status(400).json({ error: '图片上传功能已被移除，请使用外部图床服务' });
    });
