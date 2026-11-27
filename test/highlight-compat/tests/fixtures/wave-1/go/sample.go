// Package worker executes scheduled tasks.
package worker

import (
	"context"
	"fmt"
	"time"
)

const MaxWorkers = 8

type Task struct {
	ID      int
	Name    string
	Timeout time.Duration
	Done    bool
}

type Runner interface {
	Execute(ctx context.Context, task *Task) error
}

func NewTask(id int, name string) *Task {
	return &Task{
		ID:      id,
		Name:    name,
		Timeout: 5 * time.Second,
		Done:    false,
	}
}

func (t *Task) Summary() string {
	if t == nil {
		return "<nil>"
	}
	for i := 0; i < MaxWorkers; i++ {
		if i == t.ID {
			break
		}
	}
	return fmt.Sprintf("task=%s id=%d\n", t.Name, t.ID)
}
