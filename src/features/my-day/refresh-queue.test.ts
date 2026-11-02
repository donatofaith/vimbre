import{afterEach,expect,it,vi}from'vitest'
import{refreshQueue}from'./refresh-queue'
afterEach(()=>vi.useRealTimers())
it('coalesces several events for one mutation into one read',async()=>{vi.useFakeTimers();const load=vi.fn(async()=>{}),q=refreshQueue(load);q.schedule();q.schedule();q.schedule();await vi.advanceTimersByTimeAsync(130);expect(load).toHaveBeenCalledTimes(1);q.dispose()})
it('runs one trailing read when a mutation arrives during a request',async()=>{vi.useFakeTimers();let done!:()=>void;const load=vi.fn(()=>new Promise<void>(resolve=>{done=resolve})),q=refreshQueue(load);const first=q.run();q.schedule();q.schedule();await vi.advanceTimersByTimeAsync(130);expect(load).toHaveBeenCalledTimes(1);done();await first;await vi.advanceTimersByTimeAsync(130);expect(load).toHaveBeenCalledTimes(2);done();q.dispose()})
it('does not refresh a previous account after cleanup',async()=>{vi.useFakeTimers();const load=vi.fn(async()=>{}),q=refreshQueue(load);q.schedule();q.dispose();await vi.advanceTimersByTimeAsync(500);expect(load).not.toHaveBeenCalled()})
