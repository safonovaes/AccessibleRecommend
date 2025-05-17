namespace MapApi.Services
{
    public interface ICronService
    {
        Task UpdateJobSchedule(string newCronExpression);
    }
}
