package com.courtly.service;

import com.courtly.entity.*;
import com.courtly.exception.BusinessException;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

class ScheduleServiceTest {
    private final ScheduleService service = new ScheduleService(null,null,null,null);
    @Test void matchOccupancyBlocksCustomerBooking() {
        Court c=new Court();c.setStatus("ACTIVE");
        CourtSchedule s=new CourtSchedule();s.setCourt(c);s.setStatus("IN_MATCH");
        assertThrows(BusinessException.class,()->service.requireAvailable(List.of(s)));
    }
    @Test void maintenanceBlocksEvenAnAvailableSlot() {
        Court c=new Court();c.setStatus("MAINTENANCE");
        CourtSchedule s=new CourtSchedule();s.setCourt(c);s.setStatus("AVAILABLE");
        assertThrows(BusinessException.class,()->service.requireAvailable(List.of(s)));
    }
}
