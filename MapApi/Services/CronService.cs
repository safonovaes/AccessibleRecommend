using Quartz;

namespace MapApi.Services
{
    public class CronService : ICronService
    {
        private readonly ISchedulerFactory _schedulerFactory;
        private readonly IServiceProvider _serviceProvider;

        public CronService(ISchedulerFactory schedulerFactory, IServiceProvider serviceProvider)
        {
            _schedulerFactory = schedulerFactory;
            _serviceProvider = serviceProvider;
        }

        public async Task UpdateJobSchedule(string newCronExpression)
        {
            var scheduler = await _schedulerFactory.GetScheduler();
            var jobKey = new JobKey("IntersectedDataJob");

            if (!await scheduler.CheckExists(jobKey))
            {
                var job = JobBuilder.Create<IntersectedDataJob>()
                    .WithIdentity(jobKey)
                    .Build();
                await scheduler.AddJob(job, true);
            }

            var triggerKey = new TriggerKey("IntersectedDataJob-trigger");

            var newTrigger = TriggerBuilder.Create()
                .ForJob(jobKey)
                .WithIdentity(triggerKey)
                .WithCronSchedule(newCronExpression)
                .Build();

            await scheduler.RescheduleJob(triggerKey, newTrigger);
        }
    }
}
