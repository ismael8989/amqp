const Task = require('../model/Task');

exports.getAllTasks = async (req, res) => {
    try {
        const tasks = await Task.find({ userId: req.user.userId });
        res.status(200).json(tasks);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).json({ message: 'Error fetching tasks', error: error.message });
    }
};

exports.getTaskById = async (req, res) => {
    try {
        const task = await Task.findOne({ _id: req.params.id, userId: req.user.userId });
        
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }
        
        res.status(200).json(task);
    } catch (error) {
        console.error('Error fetching task:', error);
        res.status(500).json({ message: 'Error fetching task', error: error.message });
    }
};

exports.createTask = async (req, res) => {
    try {
        const { title, description } = req.body;
        
        if (!title) {
            return res.status(400).json({ message: 'Title is required' });
        }
        
        const task = new Task({
            title,
            description,
            userId: req.user.userId
        });
        
        const savedTask = await task.save();
        
        if (req.channel) {
            req.channel.publish(
                'task_events',
                'task.created',
                Buffer.from(JSON.stringify({
                    taskId: savedTask._id,
                    userId: req.user.userId
                }))
            );
        }
        
        res.status(201).json(savedTask);
    } catch (error) {
        console.error('Error creating task:', error);
        res.status(500).json({ message: 'Error creating task', error: error.message });
    }
};

exports.updateTask = async (req, res) => {
    try {
        const { title, description, done } = req.body;
        const updates = {};
        
        if (title !== undefined) updates.title = title;
        if (description !== undefined) updates.description = description;
        if (done !== undefined) updates.done = done;
        
        // Fixed the userId reference
        const task = await Task.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.userId },
            updates,
            { new: true }
        );
        
        if (!task) {
            return res.status(404).json({ message: 'Task not found or unauthorized' });
        }
        
        if (req.channel) {
            req.channel.publish(
                'task_events',
                'task.updated',
                Buffer.from(JSON.stringify({
                    taskId: task._id,
                    userId: req.user.userId,
                    updates
                }))
            );
        }
        
        res.status(200).json(task);
    } catch (error) {
        console.error('Error updating task:', error);
        res.status(500).json({ message: 'Error updating task', error: error.message });
    }
};

exports.deleteTask = async (req, res) => {
    try {
        // Fixed the userId reference
        const task = await Task.findOneAndDelete({ _id: req.params.id, userId: req.user.userId });
        
        if (!task) {
            return res.status(404).json({ message: 'Task not found or unauthorized' });
        }
        
        if (req.channel) {
            req.channel.publish(
                'task_events',
                'task.deleted',
                Buffer.from(JSON.stringify({
                    taskId: req.params.id,
                    userId: req.user.userId
                }))
            );
        }
        
        res.status(200).json({ message: 'Task deleted successfully' });
    } catch (error) {
        console.error('Error deleting task:', error);
        res.status(500).json({ message: 'Error deleting task', error: error.message });
    }
};

exports.getTasksByStatus = async (req, res) => {
    try {
        const done = req.query.done === 'true';
        const tasks = await Task.find({ userId: req.user.userId, done });
        res.status(200).json(tasks);
    } catch (error) {
        console.error('Error fetching tasks by status:', error);
        res.status(500).json({ message: 'Error fetching tasks', error: error.message });
    }
};